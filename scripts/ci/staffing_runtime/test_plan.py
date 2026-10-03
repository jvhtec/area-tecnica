import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from bootstrap import Bootstrap
from journal import Journal
from plan import PINS, prepare, read_source


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="staffing-plan-test-")
        self.addCleanup(self.directory.cleanup)
        self.parent = Path(self.directory.name)
        self.root = self.parent / "private-run"
        self.checkout = self.parent / "checkout"
        (self.checkout / "supabase" / ".temp").mkdir(parents=True)
        self.migrations = self.checkout / "supabase" / "migrations"
        self.migrations.mkdir()
        (self.migrations / "00000000000000_baseline.sql").write_text("select 1;", encoding="utf8")
        for name, version in PINS.items():
            (self.checkout / "supabase" / ".temp" / name).write_text(version + "\n", encoding="ascii")
        (self.checkout / "supabase" / ".temp" / "storage-migration").write_text("patrol-test", encoding="ascii")
        (self.checkout / "supabase" / ".temp" / "project-ref").write_text("remote-DO-NOT-COPY", encoding="ascii")
        self.cli = self.parent / "cli"
        self.node = self.parent / "node"
        self.cli.write_bytes(b"test-cli")
        self.node.write_bytes(b"test-node")
        self.child_calls = []

    def child(self, args, **kwargs):
        self.child_calls.append(args)
        if args[-1] == "--version":
            return subprocess.CompletedProcess(args, 0, stdout="2.107.0\n")
        Path(args[-1]).mkdir()
        return subprocess.CompletedProcess(args, 0)

    def prepared(self):
        with patch("plan.subprocess.run", side_effect=self.child):
            return prepare(self.root, self.checkout, self.cli, self.node, 55820)

    def test_prepares_fresh_local_sources_without_docker_or_remote_metadata(self):
        value = self.prepared()
        self.assertEqual(len(value["migrations"]), 1)
        project = self.root / "project" / "supabase"
        self.assertFalse((project / "migrations").exists())
        self.assertFalse((project / ".temp" / "project-ref").exists())
        self.assertNotIn("remote-DO-NOT-COPY", (self.root / "plan.json").read_text(encoding="utf8"))
        self.assertEqual(Journal(self.root / "journal.json", value["identity"]).load()["phase"], "sources-prepared")
        self.assertEqual([Path(args[0]).name for args in self.child_calls], ["cli", "node"])

    def test_refuses_reusing_any_existing_root(self):
        self.prepared()
        before = (self.root / "journal.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "Fresh"):
            self.prepared()
        self.assertEqual(before, (self.root / "journal.json").read_bytes())

    def test_refuses_existing_empty_root_and_checkout_output_before_children(self):
        self.root.mkdir()
        for target in [self.root, self.checkout / "output", self.checkout, self.parent]:
            with self.subTest(target=target), patch("plan.subprocess.run") as child, self.assertRaises(ValueError):
                prepare(target, self.checkout, self.cli, self.node, 55820)
            child.assert_not_called()

    def test_refuses_persistent_invalid_and_ambiguous_ports(self):
        for port in [54321, 54441, 54512, 0, 65535, True, "55820"]:
            with self.subTest(port=port), self.assertRaises(ValueError):
                with patch("plan.subprocess.run") as child:
                    prepare(self.root, self.checkout, self.cli, self.node, port)
                    child.assert_not_called()
        self.assertFalse(self.root.exists())

    def test_refuses_unreviewed_service_version_or_cli(self):
        (self.checkout / "supabase" / ".temp" / "postgres-version").write_text("15.8.1.085", encoding="ascii")
        with patch("plan.subprocess.run", side_effect=self.child), self.assertRaisesRegex(ValueError, "version changed"):
            prepare(self.root, self.checkout, self.cli, self.node, 55820)
        self.assertFalse(self.root.exists())
        with patch("plan.subprocess.run", return_value=subprocess.CompletedProcess([], 0, stdout="2.119.0")), self.assertRaisesRegex(ValueError, "CLI version"):
            prepare(self.root, self.checkout, self.cli, self.node, 55820)

    def test_staging_failure_retains_uncertain_journal_without_any_service_launch(self):
        def failing(args, **kwargs):
            if args[-1] == "--version":
                return self.child(args, **kwargs)
            return subprocess.CompletedProcess(args, 1)
        with patch("plan.subprocess.run", side_effect=failing), self.assertRaisesRegex(RuntimeError, "Source staging failed"):
            prepare(self.root, self.checkout, self.cli, self.node, 55820)
        value = json.loads((self.root / "journal.json").read_text(encoding="utf8"))
        self.assertEqual(value["operations"][0]["state"], "uncertain")

    def test_bootstrap_refuses_changed_cli_config_and_remote_link_before_docker(self):
        value = self.prepared()
        config = self.root / "project" / "supabase" / "config.toml"
        old = config.read_bytes()
        config.write_bytes(old + b"# changed\n")
        with patch("bootstrap.subprocess.run") as docker, self.assertRaisesRegex(ValueError, "config changed"):
            Bootstrap(self.root)
        docker.assert_not_called()
        config.write_bytes(old)
        (self.root / "project" / "supabase" / ".temp" / "project-ref").write_text("hosted", encoding="ascii")
        with patch("bootstrap.subprocess.run") as docker, self.assertRaisesRegex(ValueError, "remote link"):
            Bootstrap(self.root)
        docker.assert_not_called()
        self.assertEqual(Journal(self.root / "journal.json", value["identity"]).load()["phase"], "sources-prepared")

    def test_failed_docker_listing_does_not_mean_missing_resource(self):
        self.prepared()
        driver = Bootstrap(self.root)
        with patch("bootstrap.subprocess.run", return_value=subprocess.CompletedProcess([], 1, stdout=b"", stderr=b"daemon unavailable")), self.assertRaisesRegex(RuntimeError, "Docker operation failed"):
            driver.no_existing()
        self.assertEqual(driver.journal.load()["operations"][-1]["operation"], "prepare-private-sources")

    def test_existing_name_refuses_before_mutation(self):
        self.prepared()
        driver = Bootstrap(self.root)
        with patch.object(driver, "docker", return_value=b"existing-name"), self.assertRaisesRegex(RuntimeError, "refusing reuse"):
            driver.no_existing()

    def test_descriptor_source_changed_during_read_is_refused(self):
        actual = os.fdopen
        def changing(fd, *args, **kwargs):
            self.cli.write_bytes(b"changed-size")
            return actual(fd, *args, **kwargs)
        with patch("plan.os.fdopen", side_effect=changing), self.assertRaisesRegex(RuntimeError, "Source changed"):
            read_source(self.cli)


if __name__ == "__main__":
    unittest.main()
