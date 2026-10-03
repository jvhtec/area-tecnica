import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from journal import Journal

IDENTITY = "staffing-ci-123456789a"
FACT = {"kind": "container", "name": IDENTITY + "-auth"}


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="staffing-journal-test-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "journal.json"
        self.journal = Journal(self.path, IDENTITY)
        self.journal.create()

    def test_recorded_operation_requires_observation_before_next_operation(self):
        operation = self.journal.begin("create-auth", FACT)
        for change in [lambda: self.journal.begin("create-rest", FACT), lambda: self.journal.set_phase("ready")]:
            with self.assertRaisesRegex(RuntimeError, "Outstanding"):
                change()
        self.journal.mark_uncertain(operation)
        with self.assertRaisesRegex(RuntimeError, "Outstanding"):
            self.journal.begin("retry", FACT)
        self.journal.complete(operation, {"id": "a" * 64, "running": True})
        self.journal.set_phase("ready")
        value = self.journal.load()
        self.assertEqual(value["generation"], 4)
        self.assertEqual(value["operations"][0]["state"], "succeeded")

    def test_stale_instance_cannot_overwrite_another_writer(self):
        second = Journal(self.path, IDENTITY)
        second.load()
        self.journal.set_phase("new-phase")
        with self.assertRaisesRegex(RuntimeError, "Stale"):
            second.set_phase("old-phase")
        self.assertEqual(self.journal.load()["phase"], "new-phase")

    def test_separate_process_cannot_take_over_existing_lock(self):
        self.journal.lock.write_text("retained", encoding="utf8")
        code = "from journal import Journal; from pathlib import Path; import sys; Journal(Path(sys.argv[1]),sys.argv[2]).load()"
        result = subprocess.run([sys.executable, "-B", "-c", code, str(self.path), IDENTITY],
                                cwd=Path(__file__).parent, capture_output=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.journal.lock.read_text(encoding="utf8"), "retained")
        self.journal.lock.unlink()  # Only this test's explicitly created lock.

    def test_pre_replace_failure_preserves_old_journal_and_removes_only_own_temp(self):
        before = self.path.read_bytes()
        residue = self.path.with_name("journal-unrelated.tmp")
        residue.write_text("retain", encoding="utf8")
        with patch("journal.os.replace", side_effect=OSError("simulated failure")):
            with self.assertRaisesRegex(OSError, "simulated"):
                self.journal.set_phase("never-published")
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(residue.read_text(encoding="utf8"), "retain")
        self.assertEqual(sorted(p.name for p in self.path.parent.iterdir()), ["journal-unrelated.tmp", "journal.json"])

    def test_replaced_lock_is_retained(self):
        retained_fd = None
        with self.assertRaisesRegex(RuntimeError, "lock identity changed"):
            with self.journal._locked():
                # Rename while open works on Linux; Windows forbids it. Use
                # a mismatching lstat there to verify the same refusal branch.
                if os.name == "nt":
                    original = Path.lstat
                    def changed(path, *args, **kwargs):
                        if path == self.journal.lock:
                            return original(self.path)
                        return original(path, *args, **kwargs)
                    retained_fd = patch("journal.Path.lstat", changed)
                    retained_fd.start()
                else:
                    self.journal.lock.rename(self.path.with_name("retained-lock"))
                    self.journal.lock.write_text("replacement", encoding="utf8")
        if retained_fd:
            retained_fd.stop()
        self.assertTrue(self.journal.lock.exists())
        self.journal.lock.unlink()

    def test_exclusive_create_refuses_existing_journal_without_replacement(self):
        before = self.path.read_bytes()
        with self.assertRaises(FileExistsError):
            Journal(self.path, IDENTITY).create()
        self.assertEqual(before, self.path.read_bytes())

    def test_relative_missing_parent_and_wrong_filename_refused(self):
        for path in [Path("journal.json"), self.path.parent / "missing" / "journal.json", self.path.with_name("other.json")]:
            with self.subTest(path=path), self.assertRaises((ValueError, FileNotFoundError)):
                Journal(path, IDENTITY)

    def test_symlink_journal_and_parent_refused(self):
        target = self.path.with_name("target.json")
        target.write_bytes(self.path.read_bytes())
        self.path.unlink()
        try:
            self.path.symlink_to(target)
            alias = self.path.parent / "alias"
            alias.symlink_to(self.path.parent, target_is_directory=True)
        except OSError as error:
            self.skipTest(f"Symlink creation unavailable: {type(error).__name__}")
        with self.assertRaisesRegex(ValueError, "symlinks"):
            self.journal.load()
        with self.assertRaisesRegex(ValueError, "symlinks"):
            Journal(alias / "journal.json", IDENTITY)

    def test_foreign_identity_and_malformed_document_refused(self):
        original = json.loads(self.path.read_text(encoding="utf8"))
        for value in [None, [], {}, {**original, "identity": "staffing-ci-aaaaaaaaaa"},
                      {**original, "generation": True}, {**original, "secret": "no"},
                      {**original, "operations": [{}]}]:
            with self.subTest(value=value):
                self.path.write_text(json.dumps(value), encoding="utf8")
                with self.assertRaises(ValueError):
                    self.journal.load()

    def test_duplicate_json_keys_refused(self):
        body = self.path.read_text(encoding="utf8").replace('"protocol":1', '"protocol":2,"protocol":1')
        self.path.write_text(body, encoding="utf8")
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            self.journal.load()

    def test_no_secret_or_foreign_resource_facts_are_persisted(self):
        before = self.path.read_bytes()
        for facts in [{"env": "secret"}, {"token": "secret"}, {"name": "supabase_db_dev-history"},
                      {"id": "short"}, {"image": "mutable-tag"}, {"labelValue": "foreign"},
                      {"name": IDENTITY + "-auth\n"}, {"running": 1}, {"exitCode": True}]:
            with self.subTest(facts=facts), self.assertRaises(ValueError):
                self.journal.begin("create", facts)
            self.assertEqual(before, self.path.read_bytes())

    def test_missing_wrong_or_duplicate_completion_refused(self):
        operation = self.journal.begin("create", FACT)
        with self.assertRaises(ValueError):
            self.journal.complete(operation, {})
        with self.assertRaises(RuntimeError):
            self.journal.complete("0" * 32, {"removed": True})
        self.journal.complete(operation, {"id": "a" * 64})
        with self.assertRaises(RuntimeError):
            self.journal.complete(operation, {"id": "b" * 64})


if __name__ == "__main__":
    unittest.main()
