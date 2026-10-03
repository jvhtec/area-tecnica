#!/usr/bin/env python3
"""Run real staffing behavior on one fresh synthetic target, with private logs."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).parent / 'staffing_runtime'))
from plan import read_source
from services import validate_credentials

SUITES = [
    ('tests/assignments/ci-runtime.edge.integration.test.ts', 6),
    ('tests/assignments/staffing-campaigns.edge.integration.test.ts', 27),
    ('tests/assignments/matrix-dialog.local.integration.test.tsx', 8),
    ('tests/assignments/matrix-failure.disposable.integration.test.tsx', 3),
]


def run(root, checkout, cli, node, base_port):
    if root.exists():
        raise ValueError('Behavior runner requires a fresh private root')
    environment = {key: value for key, value in os.environ.items()
                   if not key.startswith(('STAFFING_', 'SUPABASE_', 'PG'))}
    environment['PATH'] = str(node.parent) + os.pathsep + environment.get('PATH', '')
    controller = checkout / 'scripts' / 'ci' / 'staffing-runtime.py'
    command = [sys.executable, '-B', str(controller)]
    # Preparation creates the root atomically and only reports safe counts.
    subprocess.run([*command, 'prepare', '--root', str(root), '--checkout', str(checkout),
                    '--cli', str(cli), '--node', str(node), '--base-port', str(base_port)],
                   cwd=checkout, env=environment, check=True, timeout=120)
    results = []
    phase = 'prepare'
    original = None
    teardown_error = None
    try:
        for phase in ['bootstrap', 'migrate', 'services', 'cache', 'edge', 'reference']:
            args = [*command, phase, '--root', str(root)]
            if phase == 'cache': args += ['--node', str(node)]
            with (root / ('runner-' + phase + '.log')).open('xb') as log:
                subprocess.run(args, cwd=checkout, env=environment, stdout=log,
                               stderr=subprocess.STDOUT, check=True, timeout=720)
            print(json.dumps({'phase': phase, 'passed': True}), flush=True)
        manifest = json.loads(read_source(root / 'target.json'))
        keys = validate_credentials(json.loads(read_source(root / 'credentials.json')))
        environment.update(STAFFING_CI_MANIFEST=str(root / 'target.json'),
                           STAFFING_EDGE_TEST_URL=manifest['url'],
                           STAFFING_EDGE_TEST_ANON_KEY=keys['ANON_KEY'],
                           STAFFING_EDGE_TEST_SERVICE_KEY=keys['SERVICE_ROLE_KEY'])
        for index, (suite, expected) in enumerate(SUITES):
            phase = suite
            report_path = root / ('behavior-' + str(index) + '.json')
            with (root / ('behavior-' + str(index) + '.log')).open('xb') as log:
                subprocess.run([str(node), str(checkout / 'node_modules' / 'vitest' / 'vitest.mjs'),
                                'run', suite, '--maxWorkers=1', '--no-file-parallelism',
                                '--reporter=json', '--outputFile', str(report_path)],
                               cwd=checkout, env=environment, stdout=log,
                               stderr=subprocess.STDOUT, check=True, timeout=900)
            report = json.loads(read_source(report_path))
            if report.get('numPassedTests') != expected or report.get('numFailedTests') != 0 or report.get('numPendingTests') != 0 or report.get('numTotalTests') != expected or not report.get('success'):
                raise RuntimeError('Real behavior suite was skipped, failed or changed its expected case count')
            result = {'suite': suite, 'passed': expected, 'skipped': 0}
            results.append(result)
            print(json.dumps(result), flush=True)
    except BaseException as error:
        original = error
        # The controller's own final line contains a fixed refusal message, not
        # raw CLI output or private file bodies. Export only its error category.
        try:
            journal = json.loads(read_source(root / 'journal.json'))
            last = journal['operations'][-1] if journal['operations'] else {}
        except Exception:
            last = {}  # Diagnostics must never replace the original failure.
        print(json.dumps({'failedPhase': phase, 'lastOperation': last.get('operation'),
                          'operationState': last.get('state'), 'errorCategory': type(error).__name__}), flush=True)
        if phase in ['bootstrap', 'migrate', 'services', 'cache', 'edge', 'reference']:
            try:
                lines = read_source(root / ('runner-' + phase + '.log')).decode('utf8', errors='replace').splitlines()
            except Exception:
                lines = []
            safe = [line for line in lines if line.startswith('Synthetic provisioning refused (')]
            if safe:
                # Known controller errors are fixed text; arbitrary OSError or
                # subprocess diagnostics are not copied into public logs.
                message = safe[-1]
                if message.startswith(('Synthetic provisioning refused (ValueError): ', 'Synthetic provisioning refused (RuntimeError): ')) and len(message) <= 256:
                    print(message, flush=True)
    finally:
        # Safe even on a failing suite: the controller independently requires
        # ready phase, empty fixtures, certain completion and frozen ownership.
        # Failed provisioning/transport uncertainty deliberately refuses removal.
        try:
            with (root / 'runner-teardown.log').open('xb') as log:
                subprocess.run([*command, 'teardown', '--root', str(root)], cwd=checkout,
                               env=environment, stdout=log, stderr=subprocess.STDOUT,
                               check=True, timeout=300)
            print(json.dumps({'phase': 'teardown', 'passed': True}), flush=True)
        except BaseException as error:
            teardown_error = error
        summary = {'suites': results, 'behaviorPassed': original is None,
                   'ownedTeardownPassed': teardown_error is None,
                   'privateLogsRetained': True}
        (root / 'public-result.json').write_text(json.dumps(summary) + '\n', encoding='utf8')
    if original is not None or teardown_error is not None:
        raise RuntimeError('Synthetic behavior or owned teardown failed; retain private evidence, do not retry this target') from None
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('root', 'checkout', 'cli', 'node'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--base-port', type=int, default=55800)
    args = parser.parse_args()
    try:
        run(args.root, args.checkout, args.cli, args.node, args.base_port)
    except Exception as error:
        print(f'Synthetic behavior refused ({type(error).__name__}); private evidence retained', file=sys.stderr)
        raise SystemExit(1)
