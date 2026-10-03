"""Apply the snapshotted application migrations to the same isolated empty DB."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

from bootstrap import Bootstrap
from plan import private_write, read_source

TABLES = ["jobs", "staffing_requests", "job_assignments", "timesheets", "profiles", "activity_log",
          "notification_inbox", "push_delivery_attempts", "staffing_campaigns", "staffing_campaign_roles",
          "staffing_events", "technician_fridge"]


def verify_dry_run(body, names):
    observed = set(re.findall(r"\b[0-9]{14}_[a-zA-Z0-9_-]+\.sql\b", body))
    if observed != set(names) or "DRY RUN" not in body:
        raise RuntimeError("Dry-run migration list differs from the snapshot")


class Migrations(Bootstrap):
    def __init__(self, root, resume_ingress=False):
        super().__init__(root, expected_phase="empty-isolated-database", allow_migrations=resume_ingress)
        self.resume_ingress = resume_ingress
        self.cid = self.recorded_id("start-isolated-database")
        self.network_id = self.recorded_id("create-internal-network")
        self.ingress = self.identity + "-migration-ingress"
        self.tunnel = self.identity + "-migration-tunnel"
        self.project = Path(self.plan["project"])
        self.tunnel_source = Path(self.plan["checkout"]) / "tests" / "assignments" / "runtime" / "database-tunnel.py"
        self.tunnel_body = read_source(self.tunnel_source)

    def verify_empty(self):
        _, network = self.verify_db(self.cid, True)
        if network["Id"] != self.network_id:
            raise RuntimeError("Recorded database network replaced")
        query = "SELECT current_setting('cron.launch_active_jobs')='off' AND (SELECT count(*) FROM auth.users)=0 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p'));"
        if self.sql(self.cid, query) != b"t":
            raise RuntimeError("Migrations require the isolated empty database with cron disabled")

    def install(self):
        source_directory = Path(self.plan["checkout"]) / "supabase" / "migrations"
        if {path.name for path in source_directory.iterdir() if path.suffix == ".sql"} != set(self.plan["migrations"]):
            raise RuntimeError("Checkout migration list differs from the snapshot")
        bodies = {}
        for name, digest in self.plan["migrations"].items():
            if not re.fullmatch(r"[0-9]{14}_[a-zA-Z0-9_-]+\.sql", name):
                raise ValueError("Invalid snapshotted migration name")
            body = read_source(self.root / "migrations" / name)
            current = read_source(source_directory / name)
            if hashlib.sha256(body).hexdigest() != digest or current != body:
                raise RuntimeError("Migration source snapshot changed")
            bodies[name] = body
        if not bodies or len({name[:14] for name in bodies}) != len(bodies):
            raise ValueError("Expected a nonempty ordered unique migration snapshot")
        operation = self.journal.begin("install-migration-snapshot", {"kind": "source", "name": self.identity + "-migrations"})
        try:
            destination = self.project / "supabase" / "migrations"
            destination.mkdir()
            for name, body in bodies.items():
                private_write(destination / name, body)
            self.journal.complete(operation, {"sha256": hashlib.sha256(json.dumps(self.plan["migrations"], sort_keys=True).encode()).hexdigest()})
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise

    def verify_tunnel(self, tunnel_id, ingress_id):
        db, network = self.verify_db(self.cid, True, members={self.cid, tunnel_id})
        if network["Id"] != self.network_id:
            raise RuntimeError("Recorded database network replaced")
        tunnel = self.observe("container", tunnel_id)
        ingress = self.observe("network", ingress_id)
        image = self.observe("image", "python:3.13-slim")["Id"]
        if tunnel["Id"] != tunnel_id:
            raise ValueError("Migration tunnel container ID failed")
        if tunnel["Name"] != "/" + self.tunnel:
            raise ValueError("Migration tunnel container name failed")
        if not tunnel["State"]["Running"]:
            state = tunnel["State"]
            exit_code = state.get("ExitCode")
            error = state.get("Error")
            if exit_code == 1 and not error:
                raise ValueError("Migration tunnel process exited with code 1")
            if exit_code == 126:
                raise ValueError("Migration tunnel process could not execute")
            if exit_code == 127:
                raise ValueError("Migration tunnel executable was not found")
            if error:
                raise ValueError("Migration tunnel failed during container start")
            raise ValueError("Migration tunnel container is not running")
        if tunnel["Image"] != image:
            raise ValueError("Migration tunnel image identity failed")
        if tunnel["Config"]["Labels"].get("local.staffing-ci") != self.identity:
            raise ValueError("Migration tunnel ownership failed")
        if ingress["Id"] != ingress_id or ingress["Name"] != self.ingress or ingress["Internal"] or ingress["Labels"].get("local.staffing-ci") != self.identity or set(ingress["Containers"]) != {tunnel_id}:
            raise ValueError("Migration ingress ownership or membership failed")
        attachments = tunnel["NetworkSettings"]["Networks"]
        if set(attachments) != {self.network, self.ingress} or attachments[self.network]["NetworkID"] != self.network_id or attachments[self.ingress]["NetworkID"] != ingress_id:
            raise ValueError("Migration tunnel routing failed")
        host = tunnel["HostConfig"]
        expected = {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(self.plan["basePort"] + 1)}]}
        if host["PortBindings"] != expected or tunnel["NetworkSettings"]["Ports"] != expected or not host["ReadonlyRootfs"] or host["CapDrop"] != ["ALL"] or host.get("VolumesFrom"):
            raise ValueError("Unsafe migration tunnel publication or isolation")
        if "no-new-privileges" not in host["SecurityOpt"]:
            raise ValueError("Migration tunnel privilege boundary failed")
        mounts = tunnel["Mounts"]
        if len(mounts) != 1 or mounts[0]["Type"] != "bind" or mounts[0]["RW"] or mounts[0]["Destination"] != "/tunnel.py":
            raise ValueError("Unexpected migration tunnel mount")
        if self.docker("exec", tunnel_id, "cat", "/tunnel.py") != self.tunnel_body.strip():
            raise ValueError("Migration tunnel source changed")
        if tunnel["Config"]["Cmd"] != ["python", "/tunnel.py", self.database]:
            raise ValueError("Migration tunnel destination changed")
        if self.sql(self.cid, "SELECT current_setting('cron.launch_active_jobs');") != b"off":
            raise RuntimeError("Scheduler enabled before migration admission")
        return db

    def cli_push(self, dry_run, tunnel_id, ingress_id):
        self.verify_tunnel(tunnel_id, ingress_id)
        if hashlib.sha256(read_source(self.cli)).hexdigest() != self.plan["cliSha256"] or hashlib.sha256(read_source(self.project / "supabase" / "config.toml")).hexdigest() != self.plan["configSha256"]:
            raise ValueError("CLI or private config changed before migration admission")
        if (self.project / "supabase" / ".temp" / "project-ref").exists():
            raise ValueError("Unexpected remote project link before migration admission")
        if {path.name for path in (self.project / "supabase" / "migrations").iterdir()} != set(self.plan["migrations"]):
            raise ValueError("Installed migration list changed before CLI admission")
        for name, digest in self.plan["migrations"].items():
            if hashlib.sha256(read_source(self.project / "supabase" / "migrations" / name)).hexdigest() != digest:
                raise ValueError("Installed migration changed before CLI admission")
        operation = self.journal.begin("migrations-dry-run" if dry_run else "apply-application-migrations",
                                       {"kind": "process", "name": self.identity + "-migration-cli"})
        log_path = self.root / ("migrations-dry-run.log" if dry_run else "migrations-apply.log")
        try:
            args = [str(self.cli), "--workdir", str(self.project), "db", "push", "--local"]
            args += ["--dry-run"] if dry_run else ["--yes"]
            with log_path.open("xb") as log:
                result = subprocess.run(args, env=self.cli_environment(), stdout=log, stderr=subprocess.STDOUT, timeout=240)
            if result.returncode != 0:
                raise RuntimeError("Migration CLI failed; preserve exact IDs/logs without reset or retry")
            if dry_run:
                verify_dry_run(read_source(log_path).decode("utf8"), self.plan["migrations"])
            self.verify_tunnel(tunnel_id, ingress_id)
            self.journal.complete(operation, {"exitCode": 0})
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise

    def verify_schema(self):
        expected = sorted(name[:14] for name in self.plan["migrations"])
        actual = self.sql(self.cid, "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;").decode().splitlines()
        if actual != expected:
            raise RuntimeError("Applied migration versions differ from the snapshot")
        empty = "SELECT current_setting('cron.launch_active_jobs')='off' AND (SELECT count(*) FROM auth.users)=0 AND " + " AND ".join(f"(SELECT count(*) FROM public.{name})=0" for name in TABLES) + ";"
        if self.sql(self.cid, empty) != b"t":
            raise RuntimeError("Post-migration scheduler or empty-fixture proof failed")

    def run(self):
        self.verify_empty()
        if self.resume_ingress:
            self.resume_existing_ingress()
            return
        self.install()
        for kind, name in [("network", self.ingress), ("container", self.tunnel)]:
            output = self.docker(kind, "ls", "--filter", "name=" + name, "--format", "{{.Names}}" if kind == "container" else "{{.Name}}")
            if output:
                raise RuntimeError("Existing migration ingress; refuse reuse")
        labels = ["--label", "local.staffing-ci=" + self.identity]
        proof = self.mutate("create-migration-ingress", "network", self.ingress,
                            ["network", "create", *labels, self.ingress], lambda output: {"id": output.decode(), "internal": False})
        ingress_id = proof["id"]
        snapshot = self.root / "migration-tunnel.py"
        private_write(snapshot, self.tunnel_body)
        image = self.observe("image", "python:3.13-slim")["Id"]
        args = ["create", "--pull=never", "--name", self.tunnel, "--network", self.network, *labels,
                "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                "--mount", f"type=bind,src={snapshot.resolve()},dst=/tunnel.py,readonly", "-p", f"127.0.0.1:{self.plan['basePort'] + 1}:5432",
                image, "python", "/tunnel.py", self.database]
        proof = self.mutate("create-migration-tunnel", "container", self.tunnel, args, lambda output: {"id": output.decode(), "image": image})
        tunnel_id = proof["id"]
        self.mutate("connect-migration-ingress", "container", self.tunnel, ["network", "connect", ingress_id, tunnel_id], lambda _: {"id": tunnel_id, "networkId": ingress_id})
        self.mutate("start-migration-tunnel", "container", self.tunnel, ["start", tunnel_id], lambda _: {"id": tunnel_id, "running": self.observe("container", tunnel_id)["State"]["Running"]})
        self.apply_and_retire(tunnel_id, ingress_id)

    def resume_existing_ingress(self):
        """Explicitly reconcile an exited pre-SQL ingress; never retry SQL."""
        ledger = self.journal.load()
        self.journal._clear(ledger)
        names = [entry["operation"] for entry in ledger["operations"]]
        if names[-5:] != ["install-migration-snapshot", "create-migration-ingress", "create-migration-tunnel", "connect-migration-ingress", "start-migration-tunnel"]:
            raise RuntimeError("Only the recorded terminal pre-SQL ingress can be reconciled")
        tunnel_id = self.recorded_id("create-migration-tunnel")
        ingress_id = self.recorded_id("create-migration-ingress")
        tunnel = self.observe("container", tunnel_id)
        ingress = self.observe("network", ingress_id)
        if tunnel["Id"] != tunnel_id or tunnel["Name"] != "/" + self.tunnel or tunnel["State"]["Running"] or tunnel["State"]["ExitCode"] != 1 or tunnel["Config"]["Labels"].get("local.staffing-ci") != self.identity:
            raise RuntimeError("Expected the owned exited ingress with a known mount failure")
        if ingress["Id"] != ingress_id or ingress["Name"] != self.ingress or ingress["Internal"] or ingress["Containers"] or ingress["Labels"].get("local.staffing-ci") != self.identity:
            raise RuntimeError("Expected the recorded empty migration ingress network")
        attachments = tunnel["NetworkSettings"]["Networks"]
        if set(attachments) != {self.network, self.ingress} or attachments[self.network]["NetworkID"] != self.network_id or attachments[self.ingress]["NetworkID"] != ingress_id or tunnel["Config"]["Cmd"] != ["python", "/tunnel.py", self.database]:
            raise RuntimeError("Exited migration tunnel routing changed")
        mounts = tunnel["Mounts"]
        if len(mounts) != 1 or mounts[0]["Type"] != "bind" or mounts[0]["RW"] or mounts[0]["Destination"] != "/tunnel.py":
            raise RuntimeError("Unexpected exited tunnel mount")
        expected_failure = b"can't find '__main__' module in '/tunnel.py'"
        if expected_failure not in self.docker_logs(tunnel_id):
            raise RuntimeError("Unknown ingress failure; no automatic repair")
        snapshot = self.root / "migration-tunnel.py"
        if read_source(snapshot) != self.tunnel_body or snapshot.resolve() == snapshot:
            raise RuntimeError("Expected the observed redirected Windows source alias")
        self.mutate("remove-failed-migration-tunnel", "container", self.tunnel, ["rm", tunnel_id], lambda _: {"id": tunnel_id, "removed": True})
        image = self.observe("image", "python:3.13-slim")["Id"]
        args = ["create", "--pull=never", "--name", self.tunnel, "--network", self.network,
                "--label", "local.staffing-ci=" + self.identity, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                "--mount", f"type=bind,src={snapshot.resolve()},dst=/tunnel.py,readonly", "-p", f"127.0.0.1:{self.plan['basePort'] + 1}:5432",
                image, "python", "/tunnel.py", self.database]
        proof = self.mutate("create-reconciled-migration-tunnel", "container", self.tunnel, args, lambda output: {"id": output.decode(), "image": image})
        fresh_id = proof["id"]
        self.mutate("connect-reconciled-migration-ingress", "container", self.tunnel, ["network", "connect", ingress_id, fresh_id], lambda _: {"id": fresh_id, "networkId": ingress_id})
        self.mutate("start-reconciled-migration-tunnel", "container", self.tunnel, ["start", fresh_id], lambda _: {"id": fresh_id, "running": self.observe("container", fresh_id)["State"]["Running"]})
        self.apply_and_retire(fresh_id, ingress_id)

    def apply_and_retire(self, tunnel_id, ingress_id):
        self.cli_push(True, tunnel_id, ingress_id)
        self.cli_push(False, tunnel_id, ingress_id)
        self.verify_tunnel(tunnel_id, ingress_id)
        self.verify_schema()
        self.mutate("stop-migration-tunnel", "container", self.tunnel, ["stop", "--time", "5", tunnel_id], lambda _: {"id": tunnel_id, "running": self.observe("container", tunnel_id)["State"]["Running"]})
        stopped = self.observe("container", tunnel_id)
        if stopped["State"]["Running"]:
            raise RuntimeError("Migration tunnel did not stop")
        self.mutate("remove-migration-tunnel", "container", self.tunnel, ["rm", tunnel_id], lambda _: {"id": tunnel_id, "removed": True})
        network = self.observe("network", ingress_id)
        if network["Id"] != ingress_id or network["Containers"] or network["Name"] != self.ingress or network["Labels"].get("local.staffing-ci") != self.identity:
            raise RuntimeError("Migration ingress is not the recorded empty network")
        self.mutate("remove-migration-ingress", "network", self.ingress, ["network", "rm", ingress_id], lambda _: {"id": ingress_id, "removed": True})
        _, network = self.verify_db(self.cid, True)
        if network["Id"] != self.network_id:
            raise RuntimeError("Database network changed after migration ingress retirement")
        self.verify_schema()
        self.journal.set_phase("isolated-schema-applied")
        private_write(self.root / "migration-evidence.json", (json.dumps({"identity": self.identity, "databaseId": self.cid,
            "migrationCount": len(self.plan["migrations"]), "cron": "off", "twelveTablesEmpty": True,
            "authUsers": 0, "databaseRecreated": False, "migrationIngressRetired": True}) + "\n").encode("utf8"))
