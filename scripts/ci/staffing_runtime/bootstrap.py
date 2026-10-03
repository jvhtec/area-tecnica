"""Bootstrap only an empty database. Application migrations are a later phase.

All mutation attempts are journaled before launch. Errors retain identities and
private logs; this module has no automatic retry, reset or broad cleanup path.
"""
import hashlib
import json
import os
import subprocess
import time
from pathlib import Path

from journal import Journal
from plan import CLI_VERSION, EXCLUDES, private_write, read_source


class Bootstrap:
    def __init__(self, root):
        self.root = Path(root)
        self.plan = json.loads(read_source(self.root / "plan.json"))
        self.identity = self.plan["identity"]
        self.journal = Journal(self.root / "journal.json", self.identity)
        if self.journal.load()["phase"] != "sources-prepared":
            raise RuntimeError("Only a freshly prepared project may bootstrap")
        self.network = self.plan["network"]
        self.database = self.plan["database"]
        if self.network != "supabase_network_" + self.identity or self.database != "supabase_db_" + self.identity:
            raise ValueError("Foreign bootstrap resource")
        self.cli = Path(self.plan["cli"])
        if hashlib.sha256(read_source(self.cli)).hexdigest() != self.plan["cliSha256"]:
            raise ValueError("CLI executable changed")
        project = Path(self.plan["project"])
        if project != self.root / "project":
            raise ValueError("Foreign private project")
        if hashlib.sha256(read_source(project / "supabase" / "config.toml")).hexdigest() != self.plan["configSha256"]:
            raise ValueError("Bootstrap config changed")
        for name, digest in self.plan["pins"].items():
            if name not in {"postgres-version", "gotrue-version", "rest-version", "storage-version", "storage-migration"}:
                raise ValueError("Unexpected service metadata")
            if hashlib.sha256(read_source(project / "supabase" / ".temp" / name)).hexdigest() != digest:
                raise ValueError("Service metadata changed")
        if (project / "supabase" / "migrations").exists() or (project / "supabase" / ".temp" / "project-ref").exists():
            raise ValueError("Bootstrap must have no application migrations or remote link")

    def docker(self, *args, timeout=30):
        result = subprocess.run(["docker", *args], capture_output=True, timeout=timeout)
        if result.returncode:
            with (self.root / "docker-errors.log").open("ab") as log:
                log.write(result.stderr)
            raise RuntimeError("Docker operation failed; inspect private evidence, no retry")
        return result.stdout.strip()

    def observe(self, kind, name):
        value = json.loads(self.docker(kind, "inspect", name))
        if not isinstance(value, list) or len(value) != 1:
            raise ValueError("Ambiguous Docker observation")
        return value[0]

    def mutate(self, operation, kind, name, args, observe):
        operation_id = self.journal.begin(operation, {"kind": kind, "name": name})
        try:
            output = self.docker(*args)
            proof = observe(output)
            self.journal.complete(operation_id, proof)
            return proof
        except BaseException:
            self.journal.mark_uncertain(operation_id)
            raise

    def no_existing(self):
        for kind, name in [("container", self.database), ("volume", self.database), ("network", self.network)]:
            # A successful empty listing proves absence. Failed Docker reads
            # cannot be interpreted as a missing resource.
            output = self.docker(kind, "ls", "--filter", "name=" + name, "--format", "{{.Name}}" if kind == "volume" else "{{.Names}}" if kind == "container" else "{{.Name}}")
            if output:
                raise RuntimeError("Existing bootstrap resource or ambiguous name; refusing reuse")

    def verify_db(self, cid, internal):
        db = self.observe("container", cid)
        if db["Id"] != cid or db["Name"] != "/" + self.database or not db["State"]["Running"] or db["Config"]["Labels"].get("com.supabase.cli.project") != self.identity:
            raise ValueError("Database identity failed")
        expected_image = self.observe("image", "public.ecr.aws/supabase/postgres:15.8.1.022")["Id"]
        if db["Image"] != expected_image:
            raise ValueError("Database image version mismatch")
        net = self.observe("network", self.network)
        if net["Internal"] != internal or net["Labels"].get("com.supabase.cli.project") != self.identity or set(net["Containers"]) != {cid}:
            raise ValueError("Bootstrap network ownership or membership failed")
        if set(db["NetworkSettings"]["Networks"]) != {self.network} or db["NetworkSettings"]["Networks"][self.network]["NetworkID"] != net["Id"]:
            raise ValueError("Database routing failed")
        expected = {} if internal else {"5432/tcp": [{"HostIp": "", "HostPort": str(self.plan["basePort"] + 1)}]}
        if db["HostConfig"]["PortBindings"] != expected:
            raise ValueError("Database publication mismatch")
        mounts = db["Mounts"]
        if len(mounts) != 1 or mounts[0]["Type"] != "volume" or mounts[0]["Name"] != self.database or mounts[0]["Destination"] != "/var/lib/postgresql/data":
            raise ValueError("Unexpected database mount")
        volume = self.observe("volume", self.database)
        if volume["Driver"] != "local" or volume.get("Options") not in (None, {}) or volume["Labels"].get("com.supabase.cli.project") != self.identity:
            raise ValueError("Database volume backing failed")
        return db, net

    def sql(self, cid, query):
        return self.docker("exec", cid, "psql", "-h", "/var/run/postgresql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", query)

    def run(self):
        if len(self.journal.load()["operations"]) != 1:
            raise RuntimeError("Bootstrap already attempted; observe retained resources instead of relaunching")
        self.no_existing()
        labels = ["--label", "com.supabase.cli.project=" + self.identity, "--label", "local.staffing-ci=" + self.identity]
        self.mutate("create-bootstrap-network", "network", self.network,
                    ["network", "create", *labels, "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", self.network],
                    lambda _: {"id": self.observe("network", self.network)["Id"], "internal": False})
        operation_id = self.journal.begin("bootstrap-empty-database", {"kind": "container", "name": self.database})
        try:
            environment = os.environ.copy()
            for key in list(environment):
                if key.startswith("SUPABASE_") or key.startswith("PG"):
                    del environment[key]
            environment["SUPABASE_INTERNAL_IMAGE_REGISTRY"] = "public.ecr.aws"
            with (self.root / "database-bootstrap.log").open("xb") as log:
                result = subprocess.run([str(self.cli), "--workdir", self.plan["project"], "start", "-x", EXCLUDES],
                                        env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=180)
            if result.returncode:
                raise RuntimeError("Empty database bootstrap failed; inspect existing journal before recovery")
            cid = self.observe("container", self.database)["Id"]
            db, net = self.verify_db(cid, False)
            empty = "SELECT (SELECT count(*) FROM auth.users)=0 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p'));"
            if self.sql(cid, empty) != b"t":
                raise RuntimeError("Bootstrap database is not empty")
            self.journal.complete(operation_id, {"id": cid, "running": True, "image": db["Image"]})
        except BaseException:
            self.journal.mark_uncertain(operation_id)
            raise
        self.isolate(db, net, labels, empty)

    def isolate(self, db, net, labels, empty):
        cid = db["Id"]
        entry = db["Config"]["Entrypoint"]
        if db["Config"]["Cmd"] or len(entry) != 3 or sum(value.count("docker-entrypoint.sh postgres") for value in entry) != 1:
            raise ValueError("Unknown bootstrap entrypoint; do not reconstruct it")
        entry = [value.replace("docker-entrypoint.sh postgres", "docker-entrypoint.sh postgres -c cron.launch_active_jobs=off") for value in entry]
        values = db["Config"]["Env"]
        if any("\n" in value or "\r" in value for value in values):
            raise ValueError("Invalid private database environment")
        private_write(self.root / "database-private.env", ("\n".join(values) + "\n").encode("utf8"))
        self.mutate("stop-bootstrap-database", "container", self.database, ["stop", "--time", "10", cid],
                    lambda _: {"id": cid, "running": self.observe("container", cid)["State"]["Running"]})
        if self.observe("container", cid)["State"]["Running"]:
            raise RuntimeError("Database did not stop")
        self.mutate("remove-bootstrap-container", "container", self.database, ["rm", cid], lambda _: {"id": cid, "removed": True})
        if self.observe("network", net["Id"])["Containers"]:
            raise RuntimeError("Bootstrap network is no longer empty")
        self.mutate("remove-bootstrap-network", "network", self.network, ["network", "rm", net["Id"]], lambda _: {"id": net["Id"], "removed": True})
        self.mutate("create-internal-network", "network", self.network,
                    ["network", "create", "--internal", *labels, self.network],
                    lambda _: {"id": self.observe("network", self.network)["Id"], "internal": True})
        args = ["create", "--pull=never", "--name", self.database, "--network", self.network, *labels,
                "--env-file", str(self.root / "database-private.env"), "-v", self.database + ":/var/lib/postgresql/data"]
        if db["Config"].get("WorkingDir"):
            args += ["--workdir", db["Config"]["WorkingDir"]]
        if db["Config"].get("User"):
            args += ["--user", db["Config"]["User"]]
        args += ["--entrypoint", entry[0], db["Image"], *entry[1:]]
        proof = self.mutate("create-isolated-database", "container", self.database, args,
                            lambda result: {"id": result.decode(), "running": False})
        fresh_id = proof["id"]
        self.mutate("start-isolated-database", "container", self.database, ["start", fresh_id],
                    lambda _: {"id": fresh_id, "running": self.observe("container", fresh_id)["State"]["Running"]})
        deadline = time.monotonic() + 30
        while True:
            ready = subprocess.run(["docker", "exec", fresh_id, "pg_isready", "-h", "/var/run/postgresql", "-U", "postgres"], capture_output=True, timeout=5)
            if ready.returncode == 0:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError("Isolated database not ready; retain recorded resource IDs")
            time.sleep(0.5)
        self.finish_empty()

    def finish_empty(self):
        """Read-only reconciliation after a terminal bootstrap; never recreate it."""
        journal = self.journal.load()
        self.journal._clear(journal)
        operations = journal["operations"]
        if len(operations) != 9 or operations[-2]["operation"] != "create-isolated-database" or operations[-1]["operation"] != "start-isolated-database":
            raise RuntimeError("Expected the recorded isolated database creation/start")
        fresh_id = operations[-1]["observation"]["id"]
        if operations[-2]["observation"]["id"] != fresh_id:
            raise RuntimeError("Ambiguous isolated database identity")
        self.verify_db(fresh_id, True)
        empty = "SELECT (SELECT count(*) FROM auth.users)=0 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p'));"
        if self.sql(fresh_id, empty) != b"t" or self.sql(fresh_id, "SELECT current_setting('cron.launch_active_jobs');") != b"off":
            raise RuntimeError("Empty isolated database scheduler proof failed")
        self.journal.set_phase("empty-isolated-database")
        private_write(self.root / "bootstrap-evidence.json", (json.dumps({"identity": self.identity,
            "databaseId": fresh_id, "databaseEmpty": True, "authUsers": 0, "applicationMigrationsApplied": False,
            "cron": "off", "internalNetworkOnly": True, "publishedPorts": False}) + "\n").encode("utf8"))
