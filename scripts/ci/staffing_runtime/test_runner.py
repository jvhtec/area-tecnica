import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from services import credentials

spec = importlib.util.spec_from_file_location('staffing_behavior_runner', Path(__file__).parent.parent / 'run-staffing-runtime.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='staffing-runner-')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name) / 'private'
        self.checkout = Path(directory.name) / 'checkout'
        self.calls = []
        self.keys = credentials()
        self.fail = None
        self.skip = False
        self.fail_teardown = False

    def child(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if args[2].endswith('staffing-runtime.py'):
            phase = args[3]
            if phase == 'prepare':
                self.root.mkdir()
                (self.root / 'target.json').write_text(json.dumps({'url': 'http://127.0.0.1:55800'}))
                (self.root / 'credentials.json').write_text(json.dumps(self.keys))
            if phase == self.fail or (phase == 'teardown' and self.fail_teardown):
                raise subprocess.CalledProcessError(1, args)
        else:
            suite = args[3]
            if suite == self.fail: raise subprocess.CalledProcessError(1, args)
            expected = dict(runner.SUITES)[suite]
            Path(args[-1]).write_text(json.dumps({'numPassedTests': expected - int(self.skip),
                'numFailedTests': 0, 'numPendingTests': int(self.skip), 'numTotalTests': expected, 'success': True}))
        return subprocess.CompletedProcess(args, 0)

    def invoke(self):
        with patch.object(runner.subprocess, 'run', side_effect=self.child), patch('builtins.print'):
            return runner.run(self.root, self.checkout, Path('/local/supabase'), Path('/local/node'), 55800)

    def test_runs_four_separate_real_suites_then_teardown_without_exporting_secrets(self):
        summary = self.invoke()
        self.assertEqual(sum(item['passed'] for item in summary['suites']), 44)
        self.assertTrue(summary['ownedTeardownPassed'])
        self.assertEqual(self.calls[-1][0][3], 'teardown')
        self.assertEqual(len(self.calls), 12)
        for args, kwargs in self.calls:
            self.assertTrue(kwargs['check'])
            self.assertFalse(kwargs.get('shell', False))
            for secret in self.keys.values(): self.assertNotIn(secret, json.dumps(args))
        saved = (self.root / 'public-result.json').read_text()
        for secret in self.keys.values(): self.assertNotIn(secret, saved)

    def test_failure_stops_later_suites_but_checks_owned_teardown(self):
        self.fail = runner.SUITES[1][0]
        with self.assertRaisesRegex(RuntimeError, 'do not retry'): self.invoke()
        launched = [args[3] for args, _ in self.calls]
        self.assertNotIn(runner.SUITES[2][0], launched)
        self.assertEqual(launched[-1], 'teardown')
        summary = json.loads((self.root / 'public-result.json').read_text())
        self.assertFalse(summary['behaviorPassed'])

    def test_skipped_behavior_cannot_report_success(self):
        self.skip = True
        with self.assertRaises(RuntimeError): self.invoke()
        summary = json.loads((self.root / 'public-result.json').read_text())
        self.assertFalse(summary['behaviorPassed'])
        self.assertEqual(summary['suites'], [])

    def test_teardown_failure_cannot_hide_successful_suite_results(self):
        self.fail_teardown = True
        with self.assertRaises(RuntimeError): self.invoke()
        summary = json.loads((self.root / 'public-result.json').read_text())
        self.assertTrue(summary['behaviorPassed'])
        self.assertFalse(summary['ownedTeardownPassed'])

    def test_provision_failure_stops_admission_and_does_not_retry(self):
        self.fail = 'migrate'
        with self.assertRaises(RuntimeError): self.invoke()
        self.assertEqual([args[3] for args, _ in self.calls], ['prepare', 'bootstrap', 'migrate', 'teardown'])
