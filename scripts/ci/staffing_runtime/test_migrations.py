import copy
import hashlib
import json
import subprocess
import unittest
from unittest.mock import patch

import test_plan
from journal import Journal
from migrations import Migrations, verify_dry_run


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_plan.PlanTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.plan = self.fixture.prepared()
        self.identity = self.plan["identity"]
        self.journal = Journal(self.fixture.root / "journal.json", self.identity)
        self.journal.load()
        self.cid = "a" * 64
        self.network_id = "b" * 64
        for operation in ["create-bootstrap-network", "bootstrap-empty-database", "stop-bootstrap-database",
                          "remove-bootstrap-container", "remove-bootstrap-network", "create-internal-network",
                          "create-isolated-database", "start-isolated-database"]:
            current = self.journal.begin(operation, {"kind": "container", "name": self.identity + "-resource"})
            self.journal.complete(current, {"id": self.network_id if operation == "create-internal-network" else self.cid})
        self.journal.set_phase("empty-isolated-database")
        source = self.fixture.checkout / "tests" / "assignments" / "runtime" / "database-tunnel.py"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"# fixed local tunnel\n")
        self.driver = Migrations(self.fixture.root)

    def test_exact_dry_run_list_is_required(self):
        names = list(self.plan["migrations"])
        verify_dry_run("DRY RUN\n" + names[0], names)
        for value in [names[0], "DRY RUN", "DRY RUN\n00000000000001_foreign.sql", "DRY RUN\n" + names[0] + "\n00000000000001_extra.sql"]:
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "differs"):
                verify_dry_run(value, names)

    def test_changed_snapshot_or_checkout_refused_before_install(self):
        source = self.fixture.root / "migrations" / next(iter(self.plan["migrations"]))
        source.write_bytes(b"changed")
        before = (self.fixture.root / "journal.json").read_bytes()
        with self.assertRaisesRegex(RuntimeError, "snapshot changed"):
            self.driver.install()
        self.assertEqual(before, (self.fixture.root / "journal.json").read_bytes())
        self.assertFalse((self.fixture.root / "project" / "supabase" / "migrations").exists())

    def test_new_checkout_migration_refused_before_journal_or_install(self):
        directory = self.fixture.checkout / "supabase" / "migrations"
        (directory / "00000000000002_new.sql").write_bytes(b"select 2;")
        before = (self.fixture.root / "journal.json").read_bytes()
        with self.assertRaisesRegex(RuntimeError, "Checkout migration list"):
            self.driver.install()
        self.assertEqual(before, (self.fixture.root / "journal.json").read_bytes())
        self.assertFalse((self.fixture.root / "project" / "supabase" / "migrations").exists())

    def test_snapshot_installs_exact_bytes_once(self):
        self.driver.install()
        path = self.fixture.root / "project" / "supabase" / "migrations"
        self.assertEqual({file.name for file in path.iterdir()}, set(self.plan["migrations"]))
        for name, digest in self.plan["migrations"].items():
            self.assertEqual(hashlib.sha256((path / name).read_bytes()).hexdigest(), digest)
        with self.assertRaises(FileExistsError):
            self.driver.install()
        ledger = self.driver.journal.load()
        self.assertEqual(ledger["operations"][-1]["state"], "uncertain")

    def test_unknown_network_and_scheduler_refuse_empty_database(self):
        with patch.object(self.driver, "verify_db", return_value=({}, {"Id": "c" * 64})), self.assertRaisesRegex(RuntimeError, "network replaced"):
            self.driver.verify_empty()
        with patch.object(self.driver, "verify_db", return_value=({}, {"Id": self.network_id})), patch.object(self.driver, "sql", return_value=b"f"), self.assertRaisesRegex(RuntimeError, "cron disabled"):
            self.driver.verify_empty()

    def test_changed_cli_config_link_or_extra_sql_refuses_before_launch(self):
        self.driver.install()
        config = self.fixture.root / "project" / "supabase" / "config.toml"
        original = config.read_bytes()
        config.write_bytes(original + b"# changed")
        with patch.object(self.driver, "verify_tunnel"), patch("migrations.subprocess.run") as run, self.assertRaisesRegex(ValueError, "config changed"):
            self.driver.cli_push(True, "c" * 64, "d" * 64)
        run.assert_not_called()
        config.write_bytes(original)
        link = config.parent / ".temp" / "project-ref"
        link.write_text("foreign", encoding="ascii")
        with patch.object(self.driver, "verify_tunnel"), patch("migrations.subprocess.run") as run, self.assertRaisesRegex(ValueError, "project link"):
            self.driver.cli_push(True, "c" * 64, "d" * 64)
        run.assert_not_called()
        link.unlink()
        (config.parent / "migrations" / "00000000000001_extra.sql").write_text("select 2;", encoding="ascii")
        with patch.object(self.driver, "verify_tunnel"), patch("migrations.subprocess.run") as run, self.assertRaisesRegex(ValueError, "list changed"):
            self.driver.cli_push(True, "c" * 64, "d" * 64)
        run.assert_not_called()

    def test_cli_failure_or_timeout_latches_uncertainty_without_reset_retry(self):
        self.driver.install()
        for failure in [subprocess.TimeoutExpired(["local-cli"], 240)]:
            with patch.object(self.driver, "verify_tunnel"), patch("migrations.subprocess.run", side_effect=failure) as run, self.assertRaises(subprocess.TimeoutExpired):
                self.driver.cli_push(False, "c" * 64, "d" * 64)
            self.assertEqual(run.call_count, 1)
            args = run.call_args.args[0]
            self.assertIn("--local", args)
            self.assertNotIn("reset", args)
            self.assertNotIn("--linked", args)
            self.assertNotIn("--include-seed", args)
        ledger = self.driver.journal.load()
        self.assertEqual(ledger["operations"][-1]["state"], "uncertain")
        with self.assertRaisesRegex(RuntimeError, "Outstanding"):
            self.driver.journal.begin("retry", {"kind": "process", "name": self.identity + "-migration-cli"})

    def test_schema_requires_all_versions_empty_tables_and_scheduler_off(self):
        version = next(iter(self.plan["migrations"]))[:14]
        with patch.object(self.driver, "sql", side_effect=[version.encode(), b"t"]):
            self.driver.verify_schema()
        for outputs in [[b"wrong"], [version.encode(), b"f"]]:
            with patch.object(self.driver, "sql", side_effect=outputs), self.assertRaises(RuntimeError):
                self.driver.verify_schema()

    def test_private_container_logs_include_stderr(self):
        with patch("bootstrap.subprocess.run", return_value=subprocess.CompletedProcess([], 0, stdout=b"", stderr=b"known mount failure")):
            self.assertEqual(self.driver.docker_logs("c" * 64), b"known mount failure")
        with patch("bootstrap.subprocess.run", return_value=subprocess.CompletedProcess([], 1, stdout=b"", stderr=b"read failed")), self.assertRaisesRegex(RuntimeError, "diagnostic observation failed"):
            self.driver.docker_logs("c" * 64)

    def test_ingress_reconciliation_refuses_any_sql_attempt_before_observation_or_mutation(self):
        operation = self.driver.journal.begin("apply-application-migrations", {"kind": "process", "name": self.identity + "-migration-cli"})
        self.driver.journal.complete(operation, {"exitCode": 0})
        with patch.object(self.driver, "observe") as observe, patch.object(self.driver, "mutate") as mutate, self.assertRaisesRegex(RuntimeError, "pre-SQL"):
            self.driver.resume_existing_ingress()
        observe.assert_not_called()
        mutate.assert_not_called()

    def test_ingress_reconciliation_refuses_uncertainty_before_observation_or_mutation(self):
        operation = self.driver.journal.begin("create-migration-tunnel", {"kind": "container", "name": self.identity + "-migration-tunnel"})
        self.driver.journal.mark_uncertain(operation)
        with patch.object(self.driver, "observe") as observe, patch.object(self.driver, "mutate") as mutate, self.assertRaisesRegex(RuntimeError, "Outstanding"):
            self.driver.resume_existing_ingress()
        observe.assert_not_called()
        mutate.assert_not_called()

    def test_ingress_reconciliation_refuses_replaced_network_before_removal(self):
        tunnel_id, ingress_id = "c" * 64, "d" * 64
        for operation in ["install-migration-snapshot", "create-migration-ingress", "create-migration-tunnel",
                          "connect-migration-ingress", "start-migration-tunnel"]:
            entry = self.driver.journal.begin(operation, {"kind": "container", "name": self.driver.tunnel})
            self.driver.journal.complete(entry, {"id": ingress_id if operation == "create-migration-ingress" else tunnel_id})
        tunnel = {"Id": tunnel_id, "Name": "/" + self.driver.tunnel, "State": {"Running": False, "ExitCode": 1},
                  "Config": {"Labels": {"local.staffing-ci": self.identity}, "Cmd": ["python", "/tunnel.py", self.driver.database]},
                  "NetworkSettings": {"Networks": {self.driver.network: {"NetworkID": self.network_id}, self.driver.ingress: {"NetworkID": ingress_id}}}}
        ingress = {"Id": ingress_id, "Name": self.driver.ingress, "Internal": False, "Containers": {}, "Labels": {"local.staffing-ci": self.identity}}
        for fault in ["database-network", "ingress-network", "internal-ingress"]:
            container, network = copy.deepcopy(tunnel), copy.deepcopy(ingress)
            if fault == "database-network": container["NetworkSettings"]["Networks"][self.driver.network]["NetworkID"] = "f" * 64
            if fault == "ingress-network": container["NetworkSettings"]["Networks"][self.driver.ingress]["NetworkID"] = "f" * 64
            if fault == "internal-ingress": network["Internal"] = True
            with self.subTest(fault=fault), patch.object(self.driver, "observe", side_effect=[container, network]), patch.object(self.driver, "mutate") as mutate, patch.object(self.driver, "docker_logs") as logs, self.assertRaises(RuntimeError):
                self.driver.resume_existing_ingress()
            mutate.assert_not_called()
            logs.assert_not_called()

    def test_tunnel_proves_exact_identity_networks_publication_source_and_destination(self):
        tunnel_id, ingress_id, image_id = "c" * 64, "d" * 64, "sha256:" + "e" * 64
        expected_ports = {"5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": "55821"}]}
        base = {"Id": tunnel_id, "Name": "/" + self.driver.tunnel, "Image": image_id, "State": {"Running": True},
                "Config": {"Labels": {"local.staffing-ci": self.identity}, "Cmd": ["python", "/tunnel.py", self.driver.database]},
                "NetworkSettings": {"Ports": expected_ports, "Networks": {self.driver.network: {"NetworkID": self.network_id}, self.driver.ingress: {"NetworkID": ingress_id}}},
                "HostConfig": {"PortBindings": expected_ports, "ReadonlyRootfs": True, "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"], "VolumesFrom": None},
                "Mounts": [{"Type": "bind", "RW": False, "Destination": "/tunnel.py"}]}
        ingress = {"Id": ingress_id, "Name": self.driver.ingress, "Internal": False, "Labels": {"local.staffing-ci": self.identity}, "Containers": {tunnel_id: {}}}
        def verify(tunnel, network, source=None):
            def observe(kind, identity):
                return tunnel if kind == "container" else network if kind == "network" else {"Id": image_id}
            with patch.object(self.driver, "verify_db", return_value=({}, {"Id": self.network_id})), patch.object(self.driver, "observe", side_effect=observe), patch.object(self.driver, "docker", return_value=self.driver.tunnel_body.strip() if source is None else source), patch.object(self.driver, "sql", return_value=b"off"):
                self.driver.verify_tunnel(tunnel_id, ingress_id)
        verify(base, ingress)
        for fault in ["name", "image", "label", "running", "port", "network", "mount", "destination"]:
            tunnel = copy.deepcopy(base)
            if fault == "name": tunnel["Name"] = "/foreign"
            if fault == "image": tunnel["Image"] = "sha256:" + "f" * 64
            if fault == "label": tunnel["Config"]["Labels"]["local.staffing-ci"] = "foreign"
            if fault == "running": tunnel["State"]["Running"] = False
            if fault == "port": tunnel["HostConfig"]["PortBindings"]["5432/tcp"][0]["HostIp"] = "0.0.0.0"
            if fault == "network": tunnel["NetworkSettings"]["Networks"]["bridge"] = {"NetworkID": "f" * 64}
            if fault == "mount": tunnel["Mounts"][0]["RW"] = True
            if fault == "destination": tunnel["Config"]["Cmd"][-1] = "supabase_db_dev-history"
            with self.subTest(fault=fault), self.assertRaises(ValueError):
                verify(tunnel, ingress)
        with self.assertRaisesRegex(ValueError, "source changed"):
            verify(base, ingress, b"different source")


if __name__ == "__main__":
    unittest.main()
