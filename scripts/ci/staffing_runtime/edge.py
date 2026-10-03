"""Run the public staffing projection with internal-only Edge/capture services."""
import json
import secrets
from pathlib import Path

from cache import Cache, EDGE_IMAGE, PYTHON_IMAGE
from journal import unique_object
from plan import private_write, read_source
from service_checks import verify_services
from services import Services, digest, environment_bytes


class Edge(Services):
    read_cache_source = Cache.read_cache_source
    volume = Cache.volume

    def __init__(self, root, verify_only=False):
        phase = ("edge-awaiting-verification", "edge-runtime-ready") if verify_only else "edge-cache-ready"
        super().__init__(root, expected_phase=phase)
        self.stage = self.root / "cache-stage"
        self.volumes = {"code": self.identity + "-code", "cache": self.identity + "-cache"}
        self.helper_image = self.observe("image", PYTHON_IMAGE)
        self.edge_image = self.observe("image", EDGE_IMAGE)
        self.runtime_names = {kind: self.identity + "-" + kind for kind in ["capture", "edge"]}
        self.capture_source = Path(self.plan["checkout"]) / "tests" / "assignments" / "runtime" / "capture.py"

    def cached_sources(self):
        metadata = Cache.read_cache_source(self)
        for kind in self.volumes:
            Cache.volume(self, kind)
        evidence = json.loads(read_source(self.root / "cache-evidence.json"), object_pairs_hook=unique_object)
        if evidence["identity"] != self.identity or evidence["sourceHashes"] != metadata["sourceHashes"] or evidence["credentialsPassed"] is not False or evidence["handlersExecuted"] is not False or evidence["builderNetworkRetired"] is not True:
            raise ValueError("Dependency cache evidence differs from the staged source")
        # The first-use compiler/build network must already have been retired.
        ledger = self.journal.load()
        self.journal._clear(ledger)
        for operation in ["retire-dependency-builder", "retire-dependency-network", "retire-cache-inspector"]:
            entries = [item for item in ledger["operations"] if item["operation"] == operation and item["state"] == "succeeded"]
            if len(entries) != 1 or entries[0]["observation"].get("removed") is not True:
                raise ValueError("Dependency build retirement is unproven")
        return metadata

    def runtime_environment(self, keys, token_secret):
        return {"CI_STACK_ID": self.identity, "CI_CONTROL_TOKEN": keys["CONTROL_TOKEN"],
                "SUPABASE_URL": "http://" + self.identity + "-gateway:8000", "SUPABASE_ANON_KEY": keys["ANON_KEY"],
                "SUPABASE_SERVICE_ROLE_KEY": keys["SERVICE_ROLE_KEY"], "JWT_SECRET": keys["JWT_SECRET"],
                "SUPABASE_PUBLIC_URL": self.url, "STAFFING_TOKEN_SECRET": token_secret, "DENO_DIR": "/cache/deno",
                "BREVO_API_KEY": "CI_DUMMY_ONLY", "BREVO_FROM": "ci@example.invalid", "WAHA_API_KEY": "CI_DUMMY_ONLY",
                "WAHA_SESSION": "ci-only", "X_AUTH_TOKEN": "CI_DUMMY_ONLY", "COMPANY_TZ": "Europe/Madrid",
                "PUBLIC_STAFFING_CONFIRM_BASE": self.url + "/functions/v1/staffing-click",
                "PUBLIC_CONFIRM_RESULT_URL": self.url + "/staffing-response.html", "PUSH_CONTACT_EMAIL": "mailto:ci@example.invalid"}

    def prepare_runtime(self):
        _, keys = verify_services(self)
        cached = self.cached_sources()
        environments = {"edge": self.runtime_environment(keys, secrets.token_hex(32)),
                        "capture": {"CI_STACK_ID": self.identity, "CI_CONTROL_TOKEN": keys["CONTROL_TOKEN"]}}
        bodies = {"capture.py": read_source(self.capture_source), **{kind + ".env": environment_bytes(value) for kind, value in environments.items()}}
        metadata = {"identity": self.identity, "hashes": {name: digest(body) for name, body in bodies.items()},
                    "images": {"edge": self.edge_image["Id"], "capture": self.helper_image["Id"]},
                    "sourceHashes": cached["sourceHashes"]}
        operation = self.journal.begin("prepare-edge-sources", {"kind": "source", "name": self.identity + "-edge-sources"})
        try:
            for name, body in bodies.items():
                private_write(self.root / name, body)
            private_write(self.root / "edge.json", (json.dumps(metadata) + "\n").encode())
            self.journal.complete(operation, {"sha256": digest(read_source(self.root / "edge.json"))})
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise
        return metadata

    def read_runtime(self):
        ledger = self.journal.load()
        self.journal._clear(ledger)
        entries = [item for item in ledger["operations"] if item["operation"] == "prepare-edge-sources"]
        body = read_source(self.root / "edge.json")
        if len(entries) != 1 or entries[0]["observation"].get("sha256") != digest(body):
            raise ValueError("Edge source metadata changed")
        value = json.loads(body, object_pairs_hook=unique_object)
        cached = self.cached_sources()
        if set(value) != {"identity", "hashes", "images", "sourceHashes"} or value["identity"] != self.identity or value["images"] != {"edge": self.edge_image["Id"], "capture": self.helper_image["Id"]} or value["sourceHashes"] != cached["sourceHashes"] or set(value["hashes"]) != {"capture.py", "edge.env", "capture.env"}:
            raise ValueError("Invalid Edge source metadata")
        for name, expected in value["hashes"].items():
            if digest(read_source(self.root / name)) != expected:
                raise ValueError("Private Edge source changed")
        if read_source(self.root / "capture.py") != read_source(self.capture_source):
            raise ValueError("Public capture source changed")
        return value

    def run(self):
        if any(item["operation"] in ("create-edge-source-admission", "prepare-edge-sources") for item in self.journal.load()["operations"]):
            raise RuntimeError("Edge startup already attempted; no automatic retry")
        verify_services(self)
        for name in self.runtime_names.values():
            if self.docker("container", "ls", "--all", "--filter", "name=" + name, "--format", "{{.Names}}"):
                raise RuntimeError("Existing Edge/capture process; refuse reuse")
        self.admit_code_before_launch()
        sources = self.prepare_runtime()
        self.read_runtime()
        _, keys = self.read_sources()
        ids = {}
        for kind, name in self.runtime_names.items():
            args = ["create", "--pull=never", "--name", name, "--network", self.network_id,
                    "--label", "local.staffing-ci=" + self.identity, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                    "--tmpfs", "/tmp:rw,nosuid,size=128m", "--env-file", str((self.root / (kind + ".env")).resolve())]
            if kind == "capture":
                args += ["--mount", f"type=bind,src={(self.root / 'capture.py').resolve()},dst=/capture.py,readonly",
                         sources["images"][kind], "python", "/capture.py"]
            else:
                args += ["--mount", f"type=volume,src={self.volumes['code']},dst=/local,readonly",
                         "--mount", f"type=volume,src={self.volumes['cache']},dst=/cache", sources["images"][kind],
                         "start", "--main-service", "/local/main", "--port", "9000", "--policy", "per_worker"]
            proof = self.mutate("create-" + kind + "-runtime", "container", name, args,
                                lambda result, image=sources["images"][kind]: {"id": result.decode(), "image": image})
            ids[kind] = proof["id"]
        for kind, cid in ids.items():
            from edge_checks import runtime_recipe
            from containers import isolated_process
            value = self.observe("container", cid)
            self.read_runtime()
            for volume in self.volumes.values():
                consumers = set(self.docker("container", "ls", "--all", "--no-trunc", "--filter", "volume=" + volume, "--format", "{{.ID}}").decode().splitlines())
                if consumers != {ids["edge"]}:
                    raise ValueError("Unexpected code/cache consumer before runtime launch")
            if value["Id"] != cid or value["Name"] != "/" + self.runtime_names[kind] or value["State"]["Status"] != "created" or value["State"]["Running"] or value["State"]["StartedAt"] != "0001-01-01T00:00:00Z":
                raise RuntimeError("Runtime launch requires the recorded never-started container")
            image, command, mounts, environment = runtime_recipe(self, kind, keys)
            isolated_process(value, self.identity, image, self.network_id, mounts, command, environment)
            attachments = value["NetworkSettings"]["Networks"]
            if set(attachments) != {self.network} or attachments[self.network]["NetworkID"] not in (self.network_id, ""):
                raise ValueError("Created runtime has unexpected routing")
            self.mutate("start-" + kind + "-runtime", "container", self.runtime_names[kind], ["start", cid],
                        lambda _, cid=cid: {"id": cid, "running": self.observe("container", cid)["State"]["Running"]})
        self.journal.set_phase("edge-awaiting-verification")
        self.finish()

    def admit_code_before_launch(self):
        expected = self.cached_sources()["sourceHashes"]
        # No credentials, internal DB connection, or production code execution.
        # Inspect the live retained volume before any credential-bearing process
        # is even created; mount identity alone cannot establish source bytes.
        probe = "import hashlib,json,pathlib; source=pathlib.Path('/local'); assert not any(p.is_symlink() for p in source.rglob('*')); print(json.dumps({'sourceHashes':{p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source.rglob('*')) if p.is_file()}}))"
        log = Cache.process(self, "edge-source-admission", ["python", "-c", probe],
                            {"/local": ("volume", self.volumes["code"], False)})
        if json.loads(read_source(log), object_pairs_hook=unique_object) != {"sourceHashes": expected}:
            raise ValueError("Live Edge source differs before credential-bearing launch")

    def finish(self):
        from edge_checks import finish_edge
        finish_edge(self)
