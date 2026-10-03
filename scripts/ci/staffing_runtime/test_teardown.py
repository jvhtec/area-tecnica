import copy
import json
import unittest
from unittest.mock import Mock, patch

import test_plan
from journal import Journal
from plan import private_write
from services import digest
from teardown import ORDER, Teardown, container_facts, network_facts, volume_facts
from services import credentials
from types import SimpleNamespace


class TeardownTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_plan.PlanTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        plan = self.fixture.prepared()
        journal = Journal(self.fixture.root / 'journal.json', plan['identity'])
        journal.load()
        journal.set_phase('teardown-ready')
        self.driver = Teardown(self.fixture.root)
        self.containers, self.networks, self.volumes = {}, {}, {}
        identity = plan['identity']
        for index, role in enumerate(ORDER, 1):
            cid = str(index) * 64
            name = plan['database'] if role == 'database' else identity + '-' + role
            mounts = [{'Type': 'volume', 'Name': plan['database']}] if role == 'database' else [{'Type': 'volume', 'Name': identity + '-' + kind} for kind in ['code', 'cache']] if role == 'edge' else []
            networks = {plan['network']: {'NetworkID': 'a' * 64}}
            if role == 'gateway': networks[identity + '-ingress'] = {'NetworkID': 'b' * 64}
            self.containers[cid] = {'Id': cid, 'Name': '/' + name, 'Image': 'sha256:' + 'c' * 64,
                'Config': {'Labels': {'local.staffing-ci': identity}}, 'HostConfig': {}, 'Mounts': mounts,
                'RestartCount': 0, 'State': {'StartedAt': 'initial-boot', 'Running': True, 'Status': 'running'},
                'NetworkSettings': {'Networks': networks}}
        for role, name, nid in [('database', plan['network'], 'a' * 64), ('ingress', identity + '-ingress', 'b' * 64)]:
            self.networks[nid] = {'Id': nid, 'Name': name, 'Created': 'created-network', 'Driver': 'bridge', 'Scope': 'local',
                'Internal': role == 'database', 'Labels': {'local.staffing-ci': identity}, 'Options': {}, 'Containers': {}}
        for role in ['database', 'code', 'cache']:
            name = plan['database'] if role == 'database' else identity + '-' + role
            self.volumes[name] = {'Name': name, 'CreatedAt': 'created-volume', 'Driver': 'local', 'Scope': 'local',
                'Labels': {'com.supabase.cli.project' if role == 'database' else 'local.staffing-ci': identity}, 'Options': {}, 'Mountpoint': '/owned/' + name}
        self.snapshot = {'identity': identity,
            'containers': {role: container_facts(self.containers[str(index) * 64]) for index, role in enumerate(ORDER, 1)},
            'networks': {role: network_facts(self.networks[nid]) for role, nid in [('database', 'a' * 64), ('ingress', 'b' * 64)]},
            'volumes': {role: volume_facts(next(item for item in self.volumes.values() if item['Name'] == (plan['database'] if role == 'database' else identity + '-' + role))) for role in ['database', 'code', 'cache']}}
        self.snapshot = copy.deepcopy(self.snapshot)
        body = (json.dumps(self.snapshot) + '\n').encode()
        private_write(self.driver.snapshot_path, body)
        operation = self.driver.journal.begin('prepare-owned-teardown', {'kind': 'source', 'name': identity + '-teardown'})
        self.driver.journal.complete(operation, {'sha256': digest(body)})
        self.calls = []
        self.driver.observe = self.observe
        self.driver.docker = self.docker

    def observe(self, kind, key):
        if kind == 'container': return copy.deepcopy(self.containers[key])
        if kind == 'volume': return copy.deepcopy(self.volumes[key])
        value = copy.deepcopy(self.networks[key])
        value['Containers'] = {cid: {} for cid, container in self.containers.items() if container['State']['Running'] and value['Name'] in container['NetworkSettings']['Networks']}
        return value

    def docker(self, *args, **kwargs):
        if len(args) > 1 and args[1] == 'ls':
            if args[0] != 'container':
                values = self.networks if args[0] == 'network' else self.volumes
                if '{{.ID}}' in args:
                    expected = args[args.index('--filter') + 1][3:]
                    return expected.encode() if expected in values else b''
                return '\n'.join(item['Name'] for item in values.values()).encode()
            values = self.containers
            filters = [args[index + 1] for index, arg in enumerate(args) if arg == '--filter']
            for condition in filters:
                if condition.startswith('id='): values = {cid: item for cid, item in values.items() if cid == condition[3:]}
                if condition.startswith('volume='): values = {cid: item for cid, item in values.items() if any(mount.get('Name') == condition[7:] for mount in item['Mounts'])}
                if condition.startswith('label='): values = {cid: item for cid, item in values.items() if item['Config']['Labels'].get('local.staffing-ci') == self.driver.identity}
            return '\n'.join(values).encode()
        self.calls.append(args)
        ledger = self.driver.journal._read()
        self.assertEqual(ledger['operations'][-1]['state'], 'pending')
        if args[0] == 'stop':
            self.containers[args[-1]]['State'].update(Running=False, Status='exited')
        elif args[0] == 'rm': del self.containers[args[1]]
        elif args[0] == 'network': del self.networks[args[2]]
        elif args[0] == 'volume': del self.volumes[args[2]]
        else: self.fail('Unexpected mutation')
        return b''

    def test_removes_exact_ids_in_order_then_empty_networks_and_unused_volumes(self):
        self.driver.run()
        self.assertEqual(len(self.calls), 17)

        self.assertEqual([call[-1] for call in self.calls[:12:2]], [self.snapshot['containers'][role]['Id'] for role in ORDER])
        self.assertTrue(all('prune' not in call and '--force' not in call for call in self.calls))
        self.assertEqual(self.driver.journal.load()['phase'], 'runtime-retired')
        self.assertTrue(self.driver.snapshot_path.exists())
        self.driver.run()
        self.assertEqual(len(self.calls), 17)

    def test_mount_observation_order_does_not_change_frozen_identity(self):
        cid = self.snapshot['containers']['edge']['Id']
        self.containers[cid]['Mounts'].reverse()
        self.driver.validate(self.snapshot, set())

    def test_all_identity_or_consumer_drift_refuses_before_first_mutation(self):
        for fault in ['owner', 'image', 'restart', 'extraContainer', 'volumeTime', 'volumeConsumer', 'networkAttachment']:
            containers, volumes = copy.deepcopy(self.containers), copy.deepcopy(self.volumes)
            cid = self.snapshot['containers']['edge']['Id']
            if fault == 'owner': self.containers[cid]['Config']['Labels']['local.staffing-ci'] = 'foreign'
            if fault == 'image': self.containers[cid]['Image'] = 'sha256:' + 'd' * 64
            if fault == 'restart': self.containers[cid]['State']['StartedAt'] = 'restarted'
            if fault in ('extraContainer', 'volumeConsumer'):
                outsider = copy.deepcopy(self.containers[cid]); outsider['Id'] = 'd' * 64
                if fault == 'volumeConsumer':
                    outsider['Config']['Labels'] = {}
                    outsider['NetworkSettings']['Networks'] = {}
                self.containers['d' * 64] = outsider
            if fault == 'volumeTime': next(iter(self.volumes.values()))['CreatedAt'] = 'replaced'
            if fault == 'networkAttachment': self.containers[cid]['NetworkSettings']['Networks'][next(iter(self.networks.values()))['Name']]['NetworkID'] = 'e' * 64
            with self.subTest(fault=fault), self.assertRaises(ValueError): self.driver.run()
            self.assertEqual(self.calls, [])
            self.containers, self.volumes = containers, volumes

    def test_partial_success_can_continue_but_unknown_stop_never_retries(self):
        original = self.driver.docker
        def uncertain(*args, **kwargs):
            if args[0] == 'stop': raise TimeoutError('unknown completion')
            return original(*args, **kwargs)
        self.driver.docker = uncertain
        with self.assertRaises(TimeoutError): self.driver.run()
        self.assertEqual(self.driver.journal.load()['operations'][-1]['state'], 'uncertain')
        self.driver.docker = Mock()
        with self.assertRaisesRegex(RuntimeError, 'Outstanding'): self.driver.run()
        self.driver.docker.assert_not_called()

    def test_interruption_between_completed_operations_resumes_without_repeating_stop(self):
        original = self.driver.validate
        def interrupt(snapshot, completed):
            if 'stop-owned-gateway' in completed and self.driver.journal._read()['operations'][-1]['state'] == 'succeeded':
                raise KeyboardInterrupt()
            return original(snapshot, completed)
        self.driver.validate = interrupt
        with self.assertRaises(KeyboardInterrupt): self.driver.run()
        self.assertEqual(len(self.calls), 1)
        self.driver.validate = original
        self.driver.run()
        self.assertEqual(len(self.calls), 17)

    def test_changed_snapshot_and_uncertain_journal_refuse_all_docker_calls(self):
        self.driver.snapshot_path.write_bytes(self.driver.snapshot_path.read_bytes() + b' ')
        self.driver.docker = Mock()
        with self.assertRaisesRegex(ValueError, 'snapshot changed'): self.driver.run()
        self.driver.docker.assert_not_called()

    def test_unrelated_drift_after_proven_stop_preserves_completion_but_refuses_removal(self):
        original = self.driver.docker
        def drift(*args, **kwargs):
            result = original(*args, **kwargs)
            if args[0] == 'stop': next(iter(self.volumes.values()))['CreatedAt'] = 'replaced'
            return result
        self.driver.docker = drift
        with self.assertRaisesRegex(ValueError, 'volume'): self.driver.run()
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.driver.journal.load()['operations'][-1]['state'], 'succeeded')

    def test_prepare_requires_empty_schema_and_held_drain_before_destructive_admission(self):
        self.driver.snapshot_path.unlink()
        # Use a fresh operation name: prior snapshot entry must not be reused.
        fixture = test_plan.PlanTests(); fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        plan = fixture.prepared()
        journal = Journal(fixture.root / 'journal.json', plan['identity']); journal.load(); journal.set_phase('edge-runtime-ready')
        driver = Teardown(fixture.root)
        snapshot = copy.deepcopy(self.snapshot); snapshot['identity'] = driver.identity
        edge = SimpleNamespace(verify_schema=Mock())
        driver.snapshot = Mock(return_value=snapshot)
        driver.validate = Mock()
        keys = credentials()
        responses = [(200, {'protocol': 1, 'boot': '12345678-1234-1234-1234-123456789abc', 'generation': 1, 'active': 0, 'uncertainty': 0}),
                     (200, {'active': 0, 'pending': 0, 'lease': 'held-local-lease'})]
        with patch('teardown.Edge', return_value=edge), patch('teardown.verify_edge', return_value=({}, keys, {})), patch('teardown.pin_runtime'), patch('teardown.pin_gateway'), patch('teardown.verify_boots'), patch('teardown.http_check', side_effect=responses):
            driver.prepare()
        edge.verify_schema.assert_called_once()
        self.assertEqual(driver.journal.load()['phase'], 'teardown-ready')
        self.assertEqual(driver.validate.call_count, 2)
        self.assertTrue(driver.snapshot_path.exists())

    def test_refused_drain_never_publishes_teardown_or_stops_resources(self):
        fixture = test_plan.PlanTests(); fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        plan = fixture.prepared()
        journal = Journal(fixture.root / 'journal.json', plan['identity']); journal.load(); journal.set_phase('edge-runtime-ready')
        driver = Teardown(fixture.root)
        snapshot = copy.deepcopy(self.snapshot); snapshot['identity'] = driver.identity
        driver.snapshot = Mock(return_value=snapshot); driver.validate = Mock(); driver.docker = Mock()
        edge = SimpleNamespace(verify_schema=Mock())
        responses = [(200, {'protocol': 1, 'boot': '12345678-1234-1234-1234-123456789abc', 'generation': 1, 'active': 0, 'uncertainty': 0}), (503, {'error': 'unavailable'})]
        with patch('teardown.Edge', return_value=edge), patch('teardown.verify_edge', return_value=({}, credentials(), {})), patch('teardown.pin_runtime'), patch('teardown.pin_gateway'), patch('teardown.http_check', side_effect=responses), self.assertRaisesRegex(RuntimeError, 'held completion'):
            driver.prepare()
        driver.docker.assert_not_called(); edge.verify_schema.assert_not_called()
        self.assertFalse(driver.snapshot_path.exists())
        self.assertEqual(driver.journal.load()['operations'][-1]['state'], 'uncertain')
