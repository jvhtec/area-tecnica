"""Retire one proven empty ready stack by frozen identities, never Docker prune.

This is not recovery for uncertain provisioning or fixture cleanup. Those
outcomes retain their private evidence and refuse automatic destruction.
"""
import json

from bootstrap import Bootstrap
from edge import Edge
from edge_checks import pin_runtime, verify_boots, verify_edge
from journal import unique_object
from plan import private_write, read_source
from service_checks import http_check, pin_gateway, quiet_state
from services import digest

ORDER = ('gateway', 'edge', 'auth', 'rest', 'capture', 'database')


def container_facts(value):
    return {key: value[key] for key in ('Id', 'Name', 'Image', 'Config', 'HostConfig', 'RestartCount')} | {
        'Mounts': sorted(value['Mounts'], key=lambda item: item.get('Destination', item.get('Name', ''))),
        'startedAt': value['State']['StartedAt'],
        'networks': {name: item['NetworkID'] for name, item in value['NetworkSettings']['Networks'].items()}}


def network_facts(value):
    return {key: value[key] for key in ('Id', 'Name', 'Created', 'Driver', 'Scope', 'Internal', 'Labels', 'Options')}


def volume_facts(value):
    return {key: value.get(key) for key in ('Name', 'CreatedAt', 'Driver', 'Scope', 'Labels', 'Options', 'Mountpoint')}


def snapshot_shape(value, identity):
    if set(value) != {'identity', 'containers', 'networks', 'volumes'} or value['identity'] != identity or set(value['containers']) != set(ORDER) or set(value['networks']) != {'database', 'ingress'} or set(value['volumes']) != {'database', 'code', 'cache'}:
        raise ValueError('Invalid owned teardown snapshot')


class Teardown(Bootstrap):
    def __init__(self, root):
        super().__init__(root, expected_phase=('edge-runtime-ready', 'teardown-ready', 'runtime-retired'), allow_migrations=True)
        self.snapshot_path = self.root / 'teardown.json'
        self.journal._clear(self.journal.load())

    def ids(self, kind, *filters):
        output = self.docker(kind, 'ls', *(['--all', '--no-trunc'] if kind == 'container' else []),
                             *[arg for value in filters for arg in ('--filter', value)],
                             '--format', '{{.ID}}' if kind == 'container' else '{{.Name}}')
        return set(output.decode().splitlines())

    def snapshot(self, driver, ids):
        ids = {**ids, 'database': driver.cid}
        containers = {role: container_facts(driver.observe('container', cid)) for role, cid in ids.items()}
        networks = {role: network_facts(driver.observe('network', nid)) for role, nid in {
            'database': driver.network_id, 'ingress': driver.recorded_id('create-service-ingress')}.items()}
        volumes = {role: volume_facts(driver.observe('volume', name)) for role, name in {
            'database': driver.database, **driver.volumes}.items()}
        return {'identity': self.identity, 'containers': containers, 'networks': networks, 'volumes': volumes}

    def prepare(self):
        driver = Edge(self.root, verify_only=True)
        ids, keys, boots = verify_edge(driver)  # Includes empty fixtures/Auth, cron off and source/volume admission.
        pin_runtime(driver, boots)
        snapshot = self.snapshot(driver, ids)
        snapshot_shape(snapshot, self.identity)
        self.validate(snapshot, set())  # Entire topology before taking the lease.
        service = keys['SERVICE_ROLE_KEY']
        status, state = http_check(driver, '/_ci-gateway-state', keys, token=service, apikey=service)
        if status != 200 or not quiet_state(state):
            raise RuntimeError('Teardown requires certain idle gateway completion')
        pin_gateway(driver, state)
        self.journal.load()  # Refresh after the other driver's affinity reads.
        operation = self.journal.begin('prepare-owned-teardown', {'kind': 'source', 'name': self.identity + '-teardown'})
        try:
            status, lease = http_check(driver, '/functions/v1/_local-drain', keys, token=service, apikey=service, method='POST')
            if status != 200 or lease.get('active') != 0 or lease.get('pending') != 0 or not isinstance(lease.get('lease'), str) or not lease['lease']:
                raise RuntimeError('Teardown has no proven held completion lease')
            verify_boots(driver, boots)
            driver.verify_schema()
            self.validate(snapshot, set())
            private_write(self.snapshot_path, (json.dumps(snapshot) + '\n').encode())
            self.journal.complete(operation, {'sha256': digest(read_source(self.snapshot_path))})
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise
        self.journal.set_phase('teardown-ready')

    def read_snapshot(self, ledger):
        entries = [item for item in ledger['operations'] if item['operation'] == 'prepare-owned-teardown']
        body = read_source(self.snapshot_path)
        if len(entries) != 1 or entries[0]['state'] != 'succeeded' or entries[0]['observation'].get('sha256') != digest(body):
            raise ValueError('Owned teardown snapshot changed')
        value = json.loads(body, object_pairs_hook=unique_object)
        snapshot_shape(value, self.identity)
        return value

    def validate(self, snapshot, completed):
        """Every remaining resource must retain its frozen identity and sole ownership."""
        remaining = {}
        for role, expected in snapshot['containers'].items():
            if 'remove-owned-' + role in completed:
                if self.ids('container', 'id=' + expected['Id']):
                    raise ValueError('Retired container reappeared')
                continue
            value = self.observe('container', expected['Id'])
            if container_facts(value) != expected or value['Config']['Labels'].get('local.staffing-ci') != self.identity:
                changed = [key for key, fact in expected.items() if container_facts(value).get(key) != fact]
                raise ValueError('Frozen container identity or configuration changed: ' + role + ' / ' + ','.join(changed))
            stopped = 'stop-owned-' + role in completed
            if value['State']['Running'] == stopped or value['State']['Status'] != ('exited' if stopped else 'running'):
                raise ValueError('Container stop or running proof changed')
            remaining[expected['Id']] = value
        if self.ids('container', 'label=local.staffing-ci=' + self.identity) != set(remaining):
            raise ValueError('Unexpected owned container inventory')
        for role, expected in snapshot['networks'].items():
            if 'remove-owned-' + role + '-network' in completed:
                if expected['Name'] in self.ids('network'):
                    raise ValueError('Retired network name reappeared')
                continue
            value = self.observe('network', expected['Id'])
            if network_facts(value) != expected or value['Labels'].get('local.staffing-ci') != self.identity:
                raise ValueError('Frozen network identity changed')
            members = {cid for cid, container in remaining.items() if container['State']['Running'] and expected['Name'] in container['NetworkSettings']['Networks']}
            if set(value['Containers']) != members:
                raise ValueError('Foreign or missing network consumer')
            for cid in members:
                if remaining[cid]['NetworkSettings']['Networks'][expected['Name']]['NetworkID'] != expected['Id']:
                    raise ValueError('Frozen network attachment changed')
        for role, expected in snapshot['volumes'].items():
            name = expected['Name']
            if 'remove-owned-' + role + '-volume' in completed:
                if name in self.ids('volume'):
                    raise ValueError('Retired volume name reappeared')
                continue
            value = self.observe('volume', name)
            owner = 'com.supabase.cli.project' if role == 'database' else 'local.staffing-ci'
            labels = value.get('Labels') or {}
            if volume_facts(value) != expected or value['Driver'] != 'local' or value['Scope'] != 'local' or value.get('Options') not in (None, {}) or labels.get(owner) != self.identity or any(key in labels and labels[key] != self.identity for key in ('local.staffing-ci', 'com.supabase.cli.project', 'local.matrix-fault')) or not value.get('CreatedAt'):
                raise ValueError('Frozen volume backing or creation identity changed')
            consumers = {cid for cid, container in remaining.items() if any(mount.get('Name') == name for mount in container['Mounts'])}
            if self.ids('container', 'volume=' + name) != consumers:
                raise ValueError('Foreign or missing volume consumer')

    def run(self):
        ledger = self.journal.load()
        self.journal._clear(ledger)
        if ledger['phase'] == 'edge-runtime-ready':
            self.prepare()
            ledger = self.journal.load()
        snapshot = self.read_snapshot(ledger)
        completed = {item['operation'] for item in ledger['operations'] if item['state'] == 'succeeded'}
        self.validate(snapshot, completed)
        for role in ORDER:
            cid = snapshot['containers'][role]['Id']
            for action, args in [('stop', ['stop', '-t', '20', cid]), ('remove', ['rm', cid])]:
                operation = action + '-owned-' + role
                if operation in completed:
                    continue
                self.validate(snapshot, completed)
                operation_id = self.journal.begin(operation, {'kind': 'container', 'name': snapshot['containers'][role]['Name'][1:], 'id': cid})
                try:
                    self.docker(*args, timeout=45)
                    if action == 'stop':
                        value = self.observe('container', cid)
                        if container_facts(value) != snapshot['containers'][role] or value['State']['Running'] or value['State']['Status'] != 'exited':
                            raise RuntimeError('Owned stop outcome could not be proven')
                    elif self.ids('container', 'id=' + cid):
                        raise RuntimeError('Owned container removal could not be proven')
                    self.journal.complete(operation_id, {'id': cid, 'running': False} if action == 'stop' else {'id': cid, 'removed': True})
                    completed.add(operation)
                except BaseException:
                    self.journal.mark_uncertain(operation_id)
                    raise
                # An unrelated topology drift cannot erase an already proven
                # operation. It still refuses the next mutation immediately.
                self.validate(snapshot, completed)
        for kind in ('network', 'volume'):
            for role, expected in snapshot[kind + 's'].items():
                operation = 'remove-owned-' + role + '-' + kind
                if operation in completed:
                    continue
                self.validate(snapshot, completed)
                resource = {'kind': kind, 'name': expected['Name']}
                if kind == 'network': resource['id'] = expected['Id']
                else: resource['createdAt'] = expected['CreatedAt']
                operation_id = self.journal.begin(operation, resource)
                try:
                    self.docker(kind, 'rm', expected['Id'] if kind == 'network' else expected['Name'])
                    if kind == 'network':
                        output = self.docker('network', 'ls', '--no-trunc', '--filter', 'id=' + expected['Id'], '--format', '{{.ID}}')
                        if output: raise RuntimeError('Owned network removal could not be proven')
                    elif expected['Name'] in self.ids('volume'):
                        raise RuntimeError('Owned volume removal could not be proven')
                    self.journal.complete(operation_id, {**resource, 'removed': True})
                    completed.add(operation)
                except BaseException:
                    self.journal.mark_uncertain(operation_id)
                    raise
                self.validate(snapshot, completed)
        self.journal.set_phase('runtime-retired')
