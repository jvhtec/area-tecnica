"""Read-only admission and real HTTP checks before staffing fixture admission."""
import json
import re
import time
import urllib.error
import urllib.request

from plan import private_write, read_source
from services import IMAGES, digest, environment_bytes


def verify_services(driver, extra_members=()):
    sources, keys = driver.read_sources()
    ids = {kind: driver.recorded_id("create-" + kind + "-service") for kind in IMAGES}
    ingress_id = driver.recorded_id("create-service-ingress")
    db = driver.verify_database(members={driver.cid, *ids.values(), *extra_members})
    ingress = driver.observe("network", ingress_id)
    if ingress["Id"] != ingress_id or ingress["Name"] != driver.ingress or ingress["Internal"] or ingress["Driver"] != "bridge" or ingress["Scope"] != "local" or ingress["Labels"].get("local.staffing-ci") != driver.identity or set(ingress["Containers"]) != {ids["gateway"]}:
        raise ValueError("Service ingress ownership or membership failed")
    environments = driver.environments(keys, driver.database_password(db))
    for kind, cid in ids.items():
        image = driver.observe("image", IMAGES[kind])
        container = driver.observe("container", cid)
        if image["Id"] != sources["images"][kind] or container["Id"] != cid or container["Name"] != "/" + driver.names[kind] or not container["State"]["Running"] or container["Image"] != image["Id"]:
            raise ValueError("Service identity, image or running state failed")
        config, host = container["Config"], container["HostConfig"]
        labels = config["Labels"]
        if labels.get("local.staffing-ci") != driver.identity or any(key in labels and labels[key] != driver.identity for key in ["com.supabase.cli.project", "local.matrix-fault"]):
            raise ValueError("Service ownership failed")
        attachments = container["NetworkSettings"]["Networks"]
        expected_networks = {driver.network: driver.network_id}
        if kind == "gateway":
            expected_networks[driver.ingress] = ingress_id
        if set(attachments) != set(expected_networks) or any(attachments[name]["NetworkID"] != expected for name, expected in expected_networks.items()):
            raise ValueError("Service routing failed")
        expected_ports = {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(driver.plan["basePort"])}]} if kind == "gateway" else {}
        live_ports = {key: value for key, value in (container["NetworkSettings"]["Ports"] or {}).items() if value is not None}
        if (host["PortBindings"] or {}) != expected_ports or live_ports != expected_ports:
            raise ValueError("Unexpected service publication")
        if not host["ReadonlyRootfs"] or host["Privileged"] or host["CapDrop"] != ["ALL"] or host.get("CapAdd") or "no-new-privileges" not in host["SecurityOpt"] or host.get("VolumesFrom") or host.get("PublishAllPorts") or host.get("ExtraHosts") or host["NetworkMode"] != driver.network:
            raise ValueError("Unsafe service isolation")
        if host.get("Tmpfs") != {"/tmp": "rw,noexec,nosuid,size=16m"}:
            raise ValueError("Unexpected service temporary storage")
        mounts = container["Mounts"]
        # Docker includes declared tmpfs mounts separately from host bindings.
        persistent = [mount for mount in mounts if mount["Type"] != "tmpfs"]
        if any(mount["Type"] == "tmpfs" and mount["Destination"] != "/tmp" for mount in mounts):
            raise ValueError("Unexpected service tmpfs mount")
        if kind == "gateway":
            if len(persistent) != 1 or persistent[0]["Type"] != "bind" or persistent[0]["RW"] or persistent[0]["Destination"] != "/gateway.py" or persistent[0]["Source"] != str((driver.root / "gateway.py").resolve()):
                raise ValueError("Unexpected gateway bind source")
            if driver.docker("exec", cid, "cat", "/gateway.py") != read_source(driver.gateway_source).strip():
                raise ValueError("Gateway runtime source changed")
        elif persistent:
            raise ValueError("Unexpected Auth/REST mounts")
        if read_source(driver.root / (kind + ".env")) != environment_bytes(environments[kind]):
            raise ValueError("Private environment differs from local service recipe")
        expected_environment = dict(item.split("=", 1) for item in image["Config"].get("Env", []))
        expected_environment.update(environments[kind])
        observed_environment = dict(item.split("=", 1) for item in config["Env"])
        if observed_environment != expected_environment or len(config["Env"]) != len(observed_environment):
            raise ValueError("Running service environment changed")
        expected_command = ["python", "/gateway.py"] if kind == "gateway" else image["Config"].get("Cmd")
        # Docker normalizes an unset image User/WorkingDir to empty text on
        # container creation. Nonempty overrides still require an exact match.
        if config.get("Cmd") != expected_command or config.get("Entrypoint") != image["Config"].get("Entrypoint") or (config.get("User") or "") != (image["Config"].get("User") or "") or (config.get("WorkingDir") or "") != (image["Config"].get("WorkingDir") or ""):
            raise ValueError("Running service command changed")
    return ids, keys


# These are fixed read-only calls inside the already verified internal gateway.
# They bypass gateway accounting during service startup; no fixture can exist yet.
READINESS = '''import contextlib,http.client,json,os
try:
    identity=os.environ['CI_STACK_ID']
    with contextlib.closing(http.client.HTTPConnection(identity+'-auth',9999,timeout=2)) as auth:
        auth.request('GET','/health'); response=auth.getresponse(); body=response.read(65537)
        assert response.status==200 and len(body)<=65536 and json.loads(body)['version']=='v2.186.0'
    with contextlib.closing(http.client.HTTPConnection(identity+'-rest',3000,timeout=2)) as rest:
        rest.request('GET','/jobs?select=id&limit=1',headers={'Authorization':'Bearer '+os.environ['CI_SERVICE_KEY']})
        response=rest.getresponse(); body=response.read(65537)
        assert response.status==200 and len(body)<=65536 and json.loads(body)==[]
    print('ready')
except Exception:
    print('waiting')
'''


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


def http_check(driver, route, keys, token=None, apikey=None, method="GET", body=None):
    if not route.startswith("/") or route.startswith("//"):
        raise ValueError("Local probe path required")
    request = urllib.request.Request(driver.url + route, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"apikey": keys["ANON_KEY"] if apikey is None else apikey,
                 "Authorization": "Bearer " + (keys["ANON_KEY"] if token is None else token), "Content-Type": "application/json"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        try:
            response = opener.open(request, timeout=12)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            payload = response.read(65537)
            if len(payload) > 65536:
                raise ValueError("Oversized local probe response")
            return response.status, json.loads(payload) if payload else None
    except (OSError, ValueError):
        raise RuntimeError("Local service HTTP observation failed") from None


def quiet_state(value):
    return isinstance(value, dict) and set(value) == {"protocol", "boot", "generation", "active", "uncertainty"} and value["protocol"] == 1 and isinstance(value["boot"], str) and re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", value["boot"]) is not None and type(value["generation"]) is int and value["generation"] >= 0 and type(value["active"]) is int and value["active"] == 0 and type(value["uncertainty"]) is int and value["uncertainty"] == 0


def pin_gateway(driver, state):
    ledger = driver.journal.load()
    driver.journal._clear(ledger)
    entries = [item for item in ledger["operations"] if item["operation"] == "pin-service-gateway-boot"]
    path = driver.root / "gateway-affinity.json"
    gateway_id = driver.recorded_id("create-gateway-service")
    if entries:
        body = read_source(path)
        if len(entries) != 1 or entries[0]["observation"].get("sha256") != digest(body):
            raise ValueError("Gateway affinity evidence changed")
        affinity = json.loads(body)
        if set(affinity) != {"boot", "generation", "gatewayId"} or affinity["gatewayId"] != gateway_id or affinity["boot"] != state["boot"] or type(affinity["generation"]) is not int or state["generation"] < affinity["generation"]:
            raise RuntimeError("Gateway restart or accounting reset; retain uncertainty")
    else:
        operation = driver.journal.begin("pin-service-gateway-boot", {"kind": "source", "name": driver.identity + "-gateway-affinity"})
        try:
            body = (json.dumps({"boot": state["boot"], "generation": state["generation"], "gatewayId": gateway_id}) + "\n").encode()
            private_write(path, body)
            driver.journal.complete(operation, {"id": gateway_id, "sha256": digest(read_source(path))})
        except BaseException:
            driver.journal.mark_uncertain(operation)
            raise


def protocol_checks(driver, keys):
    proofs = []
    def check(name, route, status, predicate=lambda _: True, **kwargs):
        actual, value = http_check(driver, route, keys, **kwargs)
        if actual != status or not predicate(value):
            raise RuntimeError("Local service protocol check failed: " + name)
        proofs.append({"name": name, "status": actual})
        return value
    service = keys["SERVICE_ROLE_KEY"]
    initial = check("initial gateway idle proof", "/_ci-gateway-state", 200, quiet_state, token=service, apikey=service)
    pin_gateway(driver, initial)
    check("pinned Auth health", "/auth/v1/health", 200, lambda value: value["version"] == "v2.186.0")
    check("local email-only Auth settings", "/auth/v1/settings", 200,
          lambda value: value["external"]["email"] and not value["external"]["phone"] and value["mailer_autoconfirm"])
    check("service Auth user listing", "/auth/v1/admin/users", 200, lambda value: value["users"] == [], token=service)
    check("anon Auth admin denial", "/auth/v1/admin/users", 403)
    check("service REST read", "/rest/v1/jobs?select=id&limit=1", 200, lambda value: value == [], token=service)
    parts = service.split(".")
    parts[2] = ("a" if parts[2][0] != "a" else "b") + parts[2][1:]
    check("real REST signature denial", "/rest/v1/jobs?select=id&limit=1", 401, lambda value: value["code"] == "PGRST301", token=".".join(parts))
    check("invalid gateway key denial", "/auth/v1/health", 401, apikey="invalid-local-key")
    check("invalid key with privileged token denial", "/rest/v1/jobs?select=id&limit=1", 401, token=service, apikey="invalid-local-key")
    check("unknown destination denial", "/http://api.brevo.com/v3/smtp/email", 404)
    check("invalid local password denial", "/auth/v1/token?grant_type=password", 400,
          lambda value: value["error_code"] == "invalid_credentials", method="POST",
          body={"email": "nonexistent-ci@example.invalid", "password": "synthetic-invalid-password"})
    # Seven upstream requests increment generation on both start and finish.
    check("terminal gateway idle proof", "/_ci-gateway-state", 200,
          lambda value: quiet_state(value) and value["boot"] == initial["boot"] and value["generation"] == initial["generation"] + 14,
          token=service, apikey=service)
    return proofs


def finish_services(driver):
    phase = driver.journal.load()["phase"]
    if phase not in ("auth-rest-awaiting-verification", "auth-rest-ready"):
        raise RuntimeError("Service verification requires the recorded terminal launch")
    deadline = time.monotonic() + 30
    while True:
        ids, keys = verify_services(driver)
        readiness = driver.docker("exec", ids["gateway"], "python", "-c", READINESS, timeout=8)
        if readiness == b"ready":
            break
        if readiness != b"waiting" or time.monotonic() >= deadline:
            raise RuntimeError("Local Auth/REST not ready; retain recorded resources for observation")
        time.sleep(0.5)
    proofs = protocol_checks(driver, keys)
    verify_services(driver)
    if phase == "auth-rest-ready":
        return  # Reverification cannot replace the initial evidence or restart services.
    affinity = json.loads(read_source(driver.root / "gateway-affinity.json"))
    private_write(driver.root / "service-evidence.json", (json.dumps({"identity": driver.identity,
        "databaseId": driver.cid, "services": ids, "checks": proofs, "cron": "off", "twelveTablesEmpty": True,
        "authUsers": 0, "gatewayBoot": affinity["boot"], "edgeProvisioned": False, "fixtureAdmission": False}) + "\n").encode())
    driver.journal.set_phase("auth-rest-ready")
