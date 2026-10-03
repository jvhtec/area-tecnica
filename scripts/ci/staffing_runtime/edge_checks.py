"""Admit the isolated Edge process, then prove real offline worker completion."""
import json
import re
import time

from containers import isolated_process
from journal import unique_object
from plan import private_write, read_source
from service_checks import http_check, pin_gateway, quiet_state, verify_services
from services import digest, environment_bytes


def runtime_recipe(driver, kind, keys):
    if kind == "capture":
        return driver.helper_image, ["python", "/capture.py"], {"/capture.py": ("bind", str((driver.root / "capture.py").resolve()), False)}, {"CI_STACK_ID": driver.identity, "CI_CONTROL_TOKEN": keys["CONTROL_TOKEN"]}
    text = read_source(driver.root / "edge.env").decode()
    pairs = [line.split("=", 1) for line in text.splitlines()]
    supplied = dict(pairs)
    secret = supplied.get("STAFFING_TOKEN_SECRET", "")
    if not re.fullmatch(r"[a-f0-9]{64}", secret):
        raise ValueError("Local staffing token secret required")
    env = driver.runtime_environment(keys, secret)
    if len(pairs) != len(supplied) or environment_bytes(env) != text.encode():
        raise ValueError("Edge environment differs from local recipe")
    return driver.edge_image, ["start", "--main-service", "/local/main", "--port", "9000", "--policy", "per_worker"], {"/local": ("volume", driver.volumes["code"], False), "/cache": ("volume", driver.volumes["cache"], True)}, env


def verify_edge(driver):
    sources = driver.read_runtime()
    runtime_ids = {kind: driver.recorded_id("create-" + kind + "-runtime") for kind in driver.runtime_names}
    service_ids, keys = verify_services(driver, extra_members=runtime_ids.values())
    facts = {}
    for kind, cid in runtime_ids.items():
        value = driver.observe("container", cid)
        if value["Id"] != cid or value["Name"] != "/" + driver.runtime_names[kind] or not value["State"]["Running"]:
            raise ValueError("Edge/capture runtime identity or running state changed")
        image, command, mounts, env = runtime_recipe(driver, kind, keys)
        isolated_process(value, driver.identity, image, driver.network_id, mounts, command, env)
        attachments = value["NetworkSettings"]["Networks"]
        if set(attachments) != {driver.network} or attachments[driver.network]["NetworkID"] != driver.network_id or any(binding for binding in (value["NetworkSettings"]["Ports"] or {}).values()):
            raise ValueError("Edge/capture routing or publication changed")
        if any(key in value["Config"]["Labels"] and value["Config"]["Labels"][key] != driver.identity for key in ["com.supabase.cli.project", "local.matrix-fault"]):
            raise ValueError("Conflicting runtime ownership")
        facts[kind] = {"id": cid, "startedAt": value["State"]["StartedAt"]}
    for volume in driver.volumes.values():
        consumers = set(driver.docker("container", "ls", "--all", "--no-trunc", "--filter", "volume=" + volume, "--format", "{{.ID}}").decode().splitlines())
        if consumers != {runtime_ids["edge"]}:
            raise ValueError("Unexpected live code/cache volume consumer")
    if driver.docker("exec", runtime_ids["capture"], "cat", "/capture.py") != read_source(driver.capture_source).strip():
        raise ValueError("Live capture source changed")
    raw = driver.docker("exec", runtime_ids["edge"], "sh", "-c", "find /local -type f -exec sha256sum {} +")
    observed = {}
    for line in raw.decode().splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  /local/(.+)", line)
        if not match or match[2] in observed:
            raise ValueError("Ambiguous live source digest")
        observed[match[2]] = match[1]
    if observed != sources["sourceHashes"]:
        raise ValueError("Live Edge source volume differs from staged source")
    return {**service_ids, **runtime_ids}, keys, facts


def pin_runtime(driver, facts):
    ledger = driver.journal.load()
    driver.journal._clear(ledger)
    entries = [item for item in ledger["operations"] if item["operation"] == "pin-edge-runtime-boots"]
    path = driver.root / "edge-affinity.json"
    if entries:
        body = read_source(path)
        if len(entries) != 1 or entries[0]["observation"].get("sha256") != digest(body) or json.loads(body, object_pairs_hook=unique_object) != facts:
            raise RuntimeError("Edge/capture restart or affinity change; retain uncertainty")
    else:
        operation = driver.journal.begin("pin-edge-runtime-boots", {"kind": "source", "name": driver.identity + "-edge-affinity"})
        try:
            private_write(path, (json.dumps(facts) + "\n").encode())
            driver.journal.complete(operation, {"sha256": digest(read_source(path))})
        except BaseException:
            driver.journal.mark_uncertain(operation)
            raise


def verify_boots(driver, facts):
    """Frozen admission also works while the caller's journal entry is pending."""
    for kind, expected in facts.items():
        value = driver.observe("container", expected["id"])
        if value["Id"] != expected["id"] or value["Name"] != "/" + driver.runtime_names[kind] or not value["State"]["Running"] or value["State"]["StartedAt"] != expected["startedAt"]:
            raise RuntimeError("Runtime boot changed under completion lease")


READINESS = '''import contextlib,http.client,json,os
try:
    identity=os.environ['CI_STACK_ID']
    for name,port,path,headers in [(identity+'-edge',9000,'/_local-health',{}),(identity+'-capture',8090,'/state',{'x-ci-control':os.environ['CI_CONTROL_TOKEN']})]:
        with contextlib.closing(http.client.HTTPConnection(name,port,timeout=2)) as channel:
            channel.request('GET',path,headers=headers); response=channel.getresponse(); body=response.read(65537)
            assert response.status==200 and len(body)<=65536
            value=json.loads(body)
            assert (value.get('runtime')=='isolated-local' and not value['unsafe'] and not value['leased'] and value['foreground']==0) if port==9000 else value=={'captured':0,'kinds':[],'blocked':0}
    print('ready')
except Exception:
    print('waiting')
'''


def healthy(value, workers=None):
    return isinstance(value, dict) and value.get("runtime") == "isolated-local" and value.get("target") == "synthetic-ci" and value.get("drain_protocol") == 1 and value.get("unsafe") is False and value.get("leased") is False and type(value.get("foreground")) is int and value["foreground"] == 0 and type(value.get("generation")) is int and value["generation"] >= 0 and type(value.get("workers")) is int and (workers is None or value["workers"] >= workers)


def protocol_checks(driver, keys):
    proofs = []
    service = keys["SERVICE_ROLE_KEY"]
    def check(name, route, status, predicate=lambda _: True, **kwargs):
        actual, value = http_check(driver, route, keys, token=service, apikey=service, **kwargs)
        if actual != status or not predicate(value):
            raise RuntimeError("Local Edge protocol check failed: " + name)
        proofs.append({"name": name, "status": actual})
        return value
    check("fresh Edge supervisor", "/functions/v1/_local-health", 200, healthy)
    check("offline bootstrap of five production workers", "/functions/v1/_local-bootstrap", 200, lambda value: value == {"bootstrapped": 5}, method="POST")
    # Explicitly supply an invalid token rather than the privileged control key.
    actual, _ = http_check(driver, "/functions/v1/manage-flex-crew-assignments", keys, token="invalid", method="POST", body={})
    if actual != 401:
        raise RuntimeError("Protected production worker accepted invalid JWT")
    proofs.append({"name": "protected handler signature denial", "status": actual})
    for mode, status in [("status500", 500), ("status503", 503)]:
        check("completed modern " + mode, "/functions/v1/_ci-probe-modern?mode=" + mode, status, lambda value: value == {"handled": True})
    check("completed legacy error", "/functions/v1/_ci-probe-legacy?mode=status503", 503, lambda value: value == {"handled": True})
    check("completed nested worker", "/functions/v1/_ci-probe-modern?mode=nested", 200, lambda value: value == {"nested": 503})
    drained = check("completion fence over actual workers", "/functions/v1/_local-drain", 200,
                    lambda value: value.get("runtime") == "isolated-local" and value.get("drain_protocol") == 1 and value.get("active") == 0 and value.get("pending") == 0 and isinstance(value.get("lease"), str), method="POST")
    check("wrong lease cannot release admission", "/functions/v1/_local-release", 409, method="POST", body={"lease": "invalid"})
    check("release verified completion fence", "/functions/v1/_local-release", 200, lambda value: value == {"released": True}, method="POST", body={"lease": drained["lease"]})
    health = check("terminal worker idle proof", "/functions/v1/_local-health", 200, lambda value: healthy(value, workers=7))
    check("empty provider sink", "/_ci-capture/state", 200, lambda value: value == {"captured": 0, "kinds": [], "blocked": 0})
    gateway = check("terminal gateway idle proof", "/_ci-gateway-state", 200, quiet_state)
    return proofs, health, gateway


def target_manifest(driver, ids):
    return {"identity": driver.identity, "network": driver.network, "networkId": driver.network_id,
            "ingress": driver.ingress, "ingressId": driver.recorded_id("create-service-ingress"), "url": driver.url,
            "database": driver.database, "databaseId": driver.cid,
            "services": {kind: {"name": (driver.runtime_names if kind in driver.runtime_names else driver.names)[kind], "id": cid,
                                   "image": driver.observe("container", cid)["Image"]} for kind, cid in ids.items()},
            "volumes": {"database": driver.database, **driver.volumes}}


def finish_edge(driver):
    phase = driver.journal.load()["phase"]
    ids, keys, facts = verify_edge(driver)
    pin_runtime(driver, facts)
    if phase == "edge-runtime-ready":
        raise RuntimeError("Initial Edge verification already completed; use the fixture harness for subsequent admission")
    deadline = time.monotonic() + 30
    while True:
        reply = driver.docker("exec", ids["gateway"], "python", "-c", READINESS, timeout=8)
        if reply == b"ready":
            break
        if reply != b"waiting" or time.monotonic() >= deadline:
            raise RuntimeError("Local Edge/capture not ready; preserve recorded resources")
        time.sleep(0.5)
    status, initial = http_check(driver, "/_ci-gateway-state", keys, token=keys["SERVICE_ROLE_KEY"], apikey=keys["SERVICE_ROLE_KEY"])
    if status != 200 or not quiet_state(initial):
        raise RuntimeError("Gateway completion is unproven before Edge startup")
    pin_gateway(driver, initial)
    operation = driver.journal.begin("verify-edge-protocol", {"kind": "process", "name": driver.identity + "-edge-verification", "id": ids["edge"]})
    try:
        proofs, health, gateway = protocol_checks(driver, keys)
        if gateway["boot"] != initial["boot"] or gateway["generation"] < initial["generation"]:
            raise RuntimeError("Gateway changed during Edge verification")
        evidence = {"identity": driver.identity, "checks": proofs, "services": ids, "runtimeBoots": facts,
                    "health": health, "gateway": gateway, "externalNetwork": False, "fixturesLoaded": False}
        private_write(driver.root / "edge-evidence.json", (json.dumps(evidence) + "\n").encode())
        driver.journal.complete(operation, {"id": ids["edge"], "sha256": digest(read_source(driver.root / "edge-evidence.json"))})
    except BaseException:
        driver.journal.mark_uncertain(operation)
        raise
    final_ids, _, final_facts = verify_edge(driver)
    if final_ids != ids or final_facts != facts:
        raise RuntimeError("Runtime changed during startup verification")
    manifest = target_manifest(driver, ids)
    operation = driver.journal.begin("publish-edge-target", {"kind": "source", "name": driver.identity + "-edge-target"})
    try:
        private_write(driver.root / "target.json", (json.dumps(manifest) + "\n").encode())
        driver.journal.complete(operation, {"sha256": digest(read_source(driver.root / "target.json"))})
    except BaseException:
        driver.journal.mark_uncertain(operation)
        raise
    driver.journal.set_phase("edge-runtime-ready")
