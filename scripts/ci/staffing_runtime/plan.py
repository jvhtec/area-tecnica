"""Prepare one fresh private CI project without Docker or database mutations."""
import hashlib
import json
import os
import re
import stat
import subprocess
import uuid
from pathlib import Path

from journal import Journal, no_links

PINS = {"postgres-version": "15.8.1.022", "gotrue-version": "v2.186.0",
        "rest-version": "v12.2.3", "storage-version": "v1.37.7"}
CLI_VERSION = "2.107.0"
EXCLUDES = "gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"


def read_source(path):
    no_links(path)
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Only regular source files are permitted")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            body = stream.read()
        named = path.lstat()
        after = os.fstat(fd)
        # Windows fstat/lstat report ctime differently for existing executables;
        # compare pathname identity/size/mtime, and ctime on the same descriptor.
        fingerprint = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
        if not stat.S_ISREG(named.st_mode) or fingerprint(info) != fingerprint(named) or fingerprint(info) != fingerprint(after) or info.st_ctime_ns != after.st_ctime_ns:
            raise RuntimeError("Source changed during read")
        return body
    finally:
        os.close(fd)


def private_write(path, body):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(body)
        stream.flush()
        os.fsync(stream.fileno())


def prepare(root: Path, checkout: Path, cli: Path, node: Path, base_port: int):
    for path in [root, checkout, cli, node]:
        if not path.is_absolute() or ".." in path.parts:
            raise ValueError("Absolute unambiguous paths required")
    no_links(root.parent)
    no_links(checkout)
    if root == root.parent or root == checkout or checkout in root.parents or root in checkout.parents or os.path.lexists(root):
        raise ValueError("Fresh private root outside checkout required")
    if type(base_port) is not int or not 55000 <= base_port <= 60000:
        raise ValueError("Dedicated bootstrap ports must start between 55000 and 60000")
    cli_bytes = read_source(cli)
    read_source(node)
    version = subprocess.run([str(cli), "--version"], capture_output=True, text=True, timeout=20, check=True).stdout.strip()
    if version != CLI_VERSION:
        raise ValueError("Pinned CI CLI version required")
    snapshot = {}
    for name, expected in PINS.items():
        body = read_source(checkout / "supabase" / ".temp" / name)
        if body.decode("ascii").strip() != expected:
            raise ValueError("Committed service version changed; review required")
        snapshot[name] = body
    storage = read_source(checkout / "supabase" / ".temp" / "storage-migration")
    if not re.fullmatch(rb"[a-zA-Z0-9_.-]{1,100}\s*", storage):
        raise ValueError("Invalid storage migration pin")
    snapshot["storage-migration"] = storage
    migrations = {}
    directory = checkout / "supabase" / "migrations"
    no_links(directory)
    for file in sorted(directory.glob("*.sql")):
        if not re.fullmatch(r"[0-9]{14}_[a-zA-Z0-9_-]+\.sql", file.name):
            raise ValueError("Ambiguous migration filename")
        migrations[file.name] = read_source(file)
    if not migrations:
        raise ValueError("Repository migrations are required")
    identity = "staffing-ci-" + uuid.uuid4().hex[:10]
    root.mkdir(mode=0o700)  # Atomic fresh-root admission; never reuse residue.
    journal = Journal(root / "journal.json", identity)
    journal.create()
    source_operation = journal.begin("prepare-private-sources", {"kind": "source", "name": identity + "-sources"})
    source_completed = False
    try:
        project = root / "project"
        supabase = project / "supabase"
        (supabase / ".temp").mkdir(parents=True)
        config = f'''project_id = "{identity}"
[api]
port = {base_port}
[db]
port = {base_port + 1}
shadow_port = {base_port + 2}
major_version = 15
[db.seed]
enabled = false
sql_paths = []
[studio]
enabled = false
port = {base_port + 3}
[inbucket]
enabled = false
port = {base_port + 4}
[db.pooler]
enabled = false
port = {base_port + 5}
[analytics]
enabled = false
port = {base_port + 6}
[edge_runtime]
enabled = false
'''
        private_write(supabase / "config.toml", config.encode("utf8"))
        for name, body in snapshot.items():
            private_write(supabase / ".temp" / name, body)
        # Keep application migrations outside the CLI project during bootstrap.
        (root / "migrations").mkdir()
        for name, body in migrations.items():
            private_write(root / "migrations" / name, body)
        projection = root / "edge-source"
        with (root / "source-staging.log").open("xb") as log:
            result = subprocess.run([str(node), str(checkout / "scripts" / "ci" / "stage-staffing-edge.mjs"),
                                     "--output", str(projection)], stdout=log, stderr=subprocess.STDOUT, timeout=45)
        if result.returncode != 0:
            raise RuntimeError("Source staging failed; retain the private prepared root")
        plan = {"protocol": 1, "identity": identity, "phase": "prepared", "project": str(project),
                "checkout": str(checkout), "cli": str(cli), "cliVersion": CLI_VERSION,
                "cliSha256": hashlib.sha256(cli_bytes).hexdigest(), "basePort": base_port,
                "network": "supabase_network_" + identity, "database": "supabase_db_" + identity,
                "projection": str(projection), "configSha256": hashlib.sha256(config.encode("utf8")).hexdigest(),
                "pins": {name: hashlib.sha256(body).hexdigest() for name, body in snapshot.items()},
                "migrations": {name: hashlib.sha256(body).hexdigest() for name, body in migrations.items()}}
        private_write(root / "plan.json", (json.dumps(plan, indent=2) + "\n").encode("utf8"))
        journal.complete(source_operation, {"sha256": hashlib.sha256(read_source(root / "plan.json")).hexdigest()})
        source_completed = True
        journal.set_phase("sources-prepared")
        return plan
    except BaseException:
        if not source_completed:
            journal.mark_uncertain(source_operation)
        raise
