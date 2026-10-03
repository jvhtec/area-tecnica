"""Private, fail-closed operation ledger. It never executes resource operations.

An interrupted pending operation requires explicit observation by its caller.
Locks and uncertain outcomes are never taken over or retried automatically.
"""
import json
import os
import re
import stat
import uuid
from contextlib import contextmanager
from pathlib import Path

IDENTITY = re.compile(r"staffing-ci-[a-f0-9]{10}")
HEX = re.compile(r"[a-f0-9]{64}")
FIELDS = {"kind", "name", "id", "image", "labelKey", "labelValue", "createdAt", "sha256",
          "exitCode", "networkId", "internal", "running", "removed", "volume"}
LABELS = {"com.supabase.cli.project", "local.staffing-ci"}


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate journal keys")
        value[key] = item
    return value


def no_links(path):
    """Require existing regular directory ancestors; never resolve links away."""
    if not path.is_absolute():
        raise ValueError("Absolute journal path required")
    for ancestor in [*reversed(path.parents), path]:
        info = ancestor.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise ValueError("Journal paths cannot contain symlinks")
        if ancestor != path and not stat.S_ISDIR(info.st_mode):
            raise ValueError("Journal ancestor must be a directory")


def facts(value, identity):
    if not isinstance(value, dict) or set(value) - FIELDS:
        raise ValueError("Only non-secret resource facts are permitted")
    for key, item in value.items():
        if item is not None and type(item) not in (str, int, bool):
            raise ValueError("Resource facts must be scalar")
        if isinstance(item, str) and (len(item) > 256 or any(ord(c) < 32 for c in item)):
            raise ValueError("Invalid resource fact text")
        if key in ("id", "networkId", "sha256") and (not isinstance(item, str) or not HEX.fullmatch(item)):
            raise ValueError("Invalid resource digest or ID")
        if key == "image" and (not isinstance(item, str) or not re.fullmatch(r"sha256:[a-f0-9]{64}", item)):
            raise ValueError("Invalid image ID")
        if key in ("name", "volume") and (not isinstance(item, str) or not re.fullmatch(
                rf"(?:supabase_(?:db|network)_)?{re.escape(identity)}(?:-[a-z0-9-]+)?", item)):
            raise ValueError("Resource name must belong to this identity")
        if key == "labelKey" and item not in LABELS:
            raise ValueError("Unexpected ownership label")
        if key == "labelValue" and item != identity:
            raise ValueError("Foreign ownership label")
        if key in ("internal", "running", "removed") and type(item) is not bool:
            raise ValueError("Boolean resource fact required")
        if key == "exitCode" and (type(item) is not int or not 0 <= item <= 255):
            raise ValueError("Invalid exit code")
        if key == "kind" and item not in ("container", "network", "volume", "schema", "process", "source"):
            raise ValueError("Invalid resource kind")
    return value


class Journal:
    def __init__(self, path: Path, identity: str):
        self.path = Path(path)
        if not isinstance(identity, str) or not IDENTITY.fullmatch(identity) or self.path.name != "journal.json":
            raise ValueError("Invalid journal identity or filename")
        no_links(self.path.parent)
        self.identity = identity
        self.generation = None
        self.lock = self.path.with_name("journal.lock")

    @contextmanager
    def _locked(self):
        no_links(self.path.parent)
        fd = os.open(self.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        info = os.fstat(fd)
        try:
            os.write(fd, uuid.uuid4().hex.encode("ascii"))
            os.fsync(fd)
            yield
        finally:
            try:
                named = self.lock.lstat()
                if not stat.S_ISREG(named.st_mode) or (info.st_dev, info.st_ino) != (named.st_dev, named.st_ino):
                    raise RuntimeError("Journal lock identity changed; retain residue")
                # Close before unlink for Windows; no stale lock takeover.
                os.close(fd)
                fd = None
                self.lock.unlink()
            finally:
                if fd is not None:
                    os.close(fd)

    def _read(self):
        no_links(self.path)
        fd = os.open(self.path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_size > 2_000_000:
                raise ValueError("Invalid journal file")
            with os.fdopen(fd, "r", encoding="utf8", closefd=False) as stream:
                value = json.load(stream, object_pairs_hook=unique_object)
            named = self.path.lstat()
            after = os.fstat(fd)
            if stat.S_ISLNK(named.st_mode) or (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) != (
                    named.st_dev, named.st_ino, named.st_size, named.st_mtime_ns) or (
                    info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns) != (
                    after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                raise RuntimeError("Journal changed during read")
        finally:
            os.close(fd)
        self._validate(value)
        return value

    def _validate(self, value):
        if not isinstance(value, dict) or set(value) != {"protocol", "identity", "generation", "phase", "operations"}:
            raise ValueError("Malformed journal")
        if value["protocol"] != 1 or value["identity"] != self.identity or type(value["generation"]) is not int or value["generation"] < 0:
            raise ValueError("Foreign or invalid journal")
        if not isinstance(value["phase"], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,99}", value["phase"]):
            raise ValueError("Invalid phase")
        if not isinstance(value["operations"], list):
            raise ValueError("Invalid operations")
        seen = set()
        for item in value["operations"]:
            if not isinstance(item, dict) or set(item) != {"operationId", "operation", "state", "resource", "observation"}:
                raise ValueError("Invalid operation record")
            if not isinstance(item["operationId"], str) or not re.fullmatch(r"[a-f0-9]{32}", item["operationId"]) or item["operationId"] in seen:
                raise ValueError("Invalid operation identity")
            seen.add(item["operationId"])
            if not isinstance(item["operation"], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,99}", item["operation"]) or item["state"] not in ("pending", "succeeded", "uncertain"):
                raise ValueError("Invalid operation state")
            facts(item["resource"], self.identity)
            facts(item["observation"], self.identity)
        if sum(item["state"] != "succeeded" for item in value["operations"]) > 1:
            raise ValueError("Ambiguous outstanding operations")

    def _persist(self, value, create=False):
        self._validate(value)
        temp = self.path.with_name("journal-" + uuid.uuid4().hex + ".tmp")
        fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        info = os.fstat(fd)
        try:
            with os.fdopen(fd, "w", encoding="utf8", closefd=False) as stream:
                json.dump(value, stream, separators=(",", ":"))
                stream.write("\n")
                stream.flush()
                os.fsync(fd)
            named = temp.lstat()
            if (named.st_dev, named.st_ino) != (info.st_dev, info.st_ino) or not stat.S_ISREG(named.st_mode):
                raise RuntimeError("Temporary journal identity changed")
            os.close(fd)
            fd = None
            if create:
                os.link(temp, self.path)  # Atomic no-overwrite publication.
            else:
                current = self._read()
                if current["generation"] != self.generation:
                    raise RuntimeError("Stale journal writer")
                os.replace(temp, self.path)
            if os.name != "nt":
                directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
        finally:
            if fd is not None:
                os.close(fd)
            try:
                named = temp.lstat()
            except FileNotFoundError:
                pass
            else:
                if not stat.S_ISREG(named.st_mode) or (named.st_dev, named.st_ino) != (info.st_dev, info.st_ino):
                    raise RuntimeError("Temporary journal replaced; retain residue")
                temp.unlink()
        self.generation = value["generation"]

    def create(self):
        with self._locked():
            self._persist({"protocol": 1, "identity": self.identity, "generation": 0,
                           "phase": "prepared", "operations": []}, create=True)

    def load(self):
        with self._locked():
            value = self._read()
            self.generation = value["generation"]
            return value

    def _change(self, edit):
        with self._locked():
            value = self._read()
            if self.generation is None or value["generation"] != self.generation:
                raise RuntimeError("Stale journal writer; explicit load required")
            edit(value)
            value["generation"] += 1
            self._persist(value)

    @staticmethod
    def _clear(value):
        if any(item["state"] != "succeeded" for item in value["operations"]):
            raise RuntimeError("Outstanding operation requires explicit observation")

    def begin(self, operation: str, resource: dict):
        operation_id = uuid.uuid4().hex
        def edit(value):
            self._clear(value)
            value["operations"].append({"operationId": operation_id, "operation": operation,
                                        "state": "pending", "resource": resource, "observation": {}})
        self._change(edit)
        return operation_id

    def _finish(self, operation_id, state, observation):
        def edit(value):
            items = [item for item in value["operations"] if item["operationId"] == operation_id]
            if len(items) != 1 or items[0]["state"] == "succeeded":
                raise RuntimeError("Expected the outstanding operation identity")
            items[0].update(state=state, observation=observation)
        self._change(edit)

    def complete(self, operation_id: str, observation: dict):
        if not observation:
            raise ValueError("Explicit observation required")
        self._finish(operation_id, "succeeded", observation)

    def mark_uncertain(self, operation_id: str):
        self._finish(operation_id, "uncertain", {})

    def set_phase(self, phase: str):
        def edit(value):
            self._clear(value)
            value["phase"] = phase
        self._change(edit)
