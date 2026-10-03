"""Compile the complete Edge import graph with no credentials or handler execution."""
import json
import os
import subprocess
from pathlib import Path

from containers import isolated_process, owned_volume, retire_terminal, run_terminal
from journal import no_links, unique_object
from plan import private_write, read_source
from service_checks import verify_services
from services import Services, digest

EDGE_IMAGE = "public.ecr.aws/supabase/edge-runtime:v1.76.2"
PYTHON_IMAGE = "python:3.13-slim"
ROOTS = ["staffing-orchestrator", "send-staffing-email", "notify-staffing-cancellation", "push", "manage-flex-crew-assignments"]
ENTRYPOINT = ("// Compile dependencies only; never execute this module.\n" + "".join(
    f"import './functions/{name}/index.ts';\n" for name in ROOTS) +
    "import './main/index.ts';\nimport './_ci-probe-modern/index.ts';\nimport './_ci-probe-legacy/index.ts';\n").encode()
INSTALL = '''import hashlib,json,pathlib,shutil
source=pathlib.Path('/source'); target=pathlib.Path('/target')
assert not list(target.iterdir())
assert not any(path.is_symlink() for path in source.rglob('*'))
shutil.copytree(source,target,dirs_exist_ok=True)
print(json.dumps({'sourceHashes':{path.relative_to(target).as_posix():hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(target.rglob('*')) if path.is_file()}}))
'''


def tree_hashes(directory):
    no_links(directory)
    result = {}
    for path in sorted(directory.rglob("*")):
        no_links(path)
        if path.is_dir():
            continue
        result[path.relative_to(directory).as_posix()] = digest(read_source(path))
    if not result:
        raise ValueError("Nonempty staged source required")
    return result


class Cache(Services):
    def __init__(self, root, node):
        super().__init__(root, expected_phase="auth-rest-ready")
        self.node = Path(node)
        if not self.node.is_absolute():
            raise ValueError("Absolute Node executable required")
        self.node_hash = digest(read_source(self.node))
        self.stage = self.root / "cache-stage"
        self.volumes = {"code": self.identity + "-code", "cache": self.identity + "-cache"}
        self.build_network = self.identity + "-dependencies"
        self.builder = self.identity + "-dependency-builder"
        self.helper_image = self.observe("image", PYTHON_IMAGE)
        self.edge_image = self.observe("image", EDGE_IMAGE)

    def prepare_cache_source(self):
        if os.path.lexists(self.stage):
            raise RuntimeError("Cache source already exists; no overwrite or retry")
        verify_services(self)
        operation = self.journal.begin("prepare-cache-sources", {"kind": "source", "name": self.identity + "-cache-sources"})
        try:
            script = Path(self.plan["checkout"]) / "scripts" / "ci" / "stage-staffing-edge.mjs"
            script_hash = digest(read_source(script))
            with (self.root / "cache-source-staging.log").open("xb") as log:
                result = subprocess.run([str(self.node), str(script), "--output", str(self.stage)],
                                        env=self.cli_environment(), stdout=log, stderr=subprocess.STDOUT, timeout=90)
            if result.returncode != 0 or digest(read_source(self.node)) != self.node_hash or digest(read_source(script)) != script_hash:
                raise RuntimeError("Cache staging failed or executable/source changed")
            expected = tree_hashes(Path(self.plan["projection"]))
            if tree_hashes(self.stage) != expected:
                raise RuntimeError("Current source projection differs from prepared source")
            private_write(self.stage / "cache-entrypoint.ts", ENTRYPOINT)
            expected["cache-entrypoint.ts"] = digest(ENTRYPOINT)
            metadata = {"identity": self.identity, "sourceHashes": expected,
                        "images": {"helper": self.helper_image["Id"], "edge": self.edge_image["Id"]}}
            private_write(self.root / "cache.json", (json.dumps(metadata) + "\n").encode())
            self.journal.complete(operation, {"sha256": digest(read_source(self.root / "cache.json"))})
            return metadata
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise

    def read_cache_source(self):
        ledger = self.journal.load()
        self.journal._clear(ledger)
        entries = [item for item in ledger["operations"] if item["operation"] == "prepare-cache-sources"]
        body = read_source(self.root / "cache.json")
        if len(entries) != 1 or entries[0]["observation"].get("sha256") != digest(body):
            raise ValueError("Cache source metadata changed")
        value = json.loads(body, object_pairs_hook=unique_object)
        if set(value) != {"identity", "sourceHashes", "images"} or value["identity"] != self.identity or value["images"] != {"helper": self.helper_image["Id"], "edge": self.edge_image["Id"]} or tree_hashes(self.stage) != value["sourceHashes"]:
            raise ValueError("Cache source bytes or images changed")
        return value

    def volume(self, kind):
        ledger = self.journal.load()
        self.journal._clear(ledger)
        entries = [item for item in ledger["operations"] if item["operation"] == "create-" + kind + "-volume"]
        if len(entries) != 1:
            raise ValueError("Expected exactly one owned volume creation")
        return owned_volume(self, self.volumes[kind], entries[0]["observation"]["createdAt"])

    def process(self, role, command, mounts, network="none", environment=None, network_id=None):
        service_ids, _ = verify_services(self)
        metadata = self.read_cache_source()
        metadata_hash = digest(read_source(self.root / "cache.json"))
        volume_times = {kind: self.volume(kind)["CreatedAt"] for kind in self.volumes}
        name = self.identity + "-" + role
        image = self.edge_image if role == "dependency-builder" else self.helper_image
        args = ["create", "--pull=never", "--name", name, "--network", network_id or network, "--label", "local.staffing-ci=" + self.identity,
                "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,nosuid,size=128m"]
        for destination, (kind, source, writable) in mounts.items():
            args += ["--mount", f"type={kind},src={source},dst={destination}" + ("" if writable else ",readonly")]
        for key, value in (environment or {}).items():
            args += ["-e", key + "=" + value]
        args += [image["Id"], *command]
        proof = self.mutate("create-" + role, "container", name, args, lambda result: {"id": result.decode(), "image": image["Id"]})
        cid = proof["id"]
        def verify():
            # This closure also runs while its own start is pending in the
            # journal. Use frozen admitted facts, never bypass ledger admission.
            self.verify_database(members={self.cid, *service_ids.values()})
            if digest(read_source(self.root / "cache.json")) != metadata_hash or tree_hashes(self.stage) != metadata["sourceHashes"]:
                raise ValueError("Cache source changed during process execution")
            for kind, volume in self.volumes.items():
                owned_volume(self, volume, volume_times[kind])
                consumers = set(self.docker("container", "ls", "--all", "--no-trunc", "--filter", "volume=" + volume, "--format", "{{.ID}}").decode().splitlines())
                expected = {cid} if any(mount[0] == "volume" and mount[1] == volume for mount in mounts.values()) else set()
                if consumers != expected:
                    raise ValueError("Unexpected source/cache volume consumer")
            value = self.observe("container", cid)
            if value["Id"] != cid or value["Name"] != "/" + name:
                raise ValueError("Owned process ID or name changed")
            isolated_process(value, self.identity, image, network_id or network, mounts, command, environment or {})
            attachments = value["NetworkSettings"]["Networks"]
            if network == "none":
                if set(attachments) != {"none"}:
                    raise ValueError("Unexpected offline helper routing")
            else:
                observed = self.observe("network", network_id)
                if observed["Id"] != network_id or observed["Name"] != network or observed["Internal"] or observed["Labels"].get("local.staffing-ci") != self.identity or set(observed["Containers"]) != ({cid} if value["State"]["Running"] else set()):
                    raise ValueError("Build network ownership or membership changed")
                permitted_ids = {network_id} if value["State"]["Running"] else {network_id, ""}
                if set(attachments) != {network} or attachments[network]["NetworkID"] not in permitted_ids:
                    raise ValueError("Build process routing changed")
            return value
        run_terminal(self, "run-" + role, name, cid, verify)
        verify_services(self)
        self.read_cache_source()
        retire_terminal(self, "retire-" + role, name, cid, verify)
        return self.root / ("run-" + role + ".log")

    def run(self):
        if any(item["operation"] == "prepare-cache-sources" for item in self.journal.load()["operations"]):
            raise RuntimeError("Cache preparation already attempted; no automatic retry")
        verify_services(self)
        for kind, name in [("volume", name) for name in self.volumes.values()] + [("network", self.build_network), ("container", self.builder),
                              ("container", self.identity + "-source-installer"), ("container", self.identity + "-cache-inspector")]:
            if self.docker(kind, "ls", "--filter", "name=" + name, "--format", "{{.Names}}" if kind == "container" else "{{.Name}}"):
                raise RuntimeError("Existing cache resource; refuse reuse")
        metadata = self.prepare_cache_source()
        for kind, name in self.volumes.items():
            def proof(_, name=name):
                value = owned_volume(self, name)
                return {"volume": name, "createdAt": value["CreatedAt"]}
            self.mutate("create-" + kind + "-volume", "volume", name,
                        ["volume", "create", "--label", "local.staffing-ci=" + self.identity, name], proof)
        installed = self.process("source-installer", ["python", "-c", INSTALL],
                     {"/source": ("bind", str(self.stage.resolve()), False), "/target": ("volume", self.volumes["code"], True)})
        if json.loads(read_source(installed), object_pairs_hook=unique_object) != {"sourceHashes": metadata["sourceHashes"]}:
            raise ValueError("Installed source differs before dependency build admission")
        proof = self.mutate("create-dependency-network", "network", self.build_network,
                            ["network", "create", "--label", "local.staffing-ci=" + self.identity, self.build_network],
                            lambda result: {"id": result.decode(), "internal": False})
        network_id = proof["id"]
        self.process("dependency-builder", ["bundle", "--entrypoint", "/local/cache-entrypoint.ts", "--output", "/cache/public-handlers.eszip", "--checksum", "sha256", "--timeout", "150"],
                     {"/local": ("volume", self.volumes["code"], False), "/cache": ("volume", self.volumes["cache"], True)},
                     network=self.build_network, environment={"DENO_DIR": "/cache/deno"}, network_id=network_id)
        network = self.observe("network", network_id)
        if network["Id"] != network_id or network["Name"] != self.build_network or network["Containers"] or network["Labels"].get("local.staffing-ci") != self.identity:
            raise ValueError("Dependency network is not the recorded empty network")
        self.mutate("retire-dependency-network", "network", self.build_network, ["network", "rm", network_id], lambda _: {"id": network_id, "removed": True})
        probe = '''import hashlib,json,pathlib
source=pathlib.Path('/local'); cache=pathlib.Path('/cache'); eszip=cache/'public-handlers.eszip'
assert eszip.is_file() and eszip.stat().st_size>1000
files={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source.rglob('*')) if p.is_file()}
count=sum(p.is_file() for p in (cache/'deno').rglob('*')); assert count>0
print(json.dumps({'sourceHashes':files,'eszipSha256':hashlib.sha256(eszip.read_bytes()).hexdigest(),'eszipBytes':eszip.stat().st_size,'dependencyFiles':count}))
'''
        log = self.process("cache-inspector", ["python", "-c", probe],
                           {"/local": ("volume", self.volumes["code"], False), "/cache": ("volume", self.volumes["cache"], False)})
        evidence = json.loads(read_source(log), object_pairs_hook=unique_object)
        if evidence["sourceHashes"] != metadata["sourceHashes"]:
            raise ValueError("Installed source volume differs from the staged bytes")
        verify_services(self)
        private_write(self.root / "cache-evidence.json", (json.dumps({"identity": self.identity, **evidence,
            "credentialsPassed": False, "handlersExecuted": False, "builderNetworkRetired": True}) + "\n").encode())
        self.journal.set_phase("edge-cache-ready")
