"""Install only the reviewed non-personal reference catalog under a runtime lease."""
import json
from pathlib import Path

from edge import Edge
from edge_checks import pin_runtime, verify_boots, verify_edge
from plan import private_write, read_source
from service_checks import http_check, pin_gateway, quiet_state
from services import digest


def install_reference(root):
    driver = Edge(root, verify_only=True)
    ledger = driver.journal.load()
    if ledger["phase"] != "edge-runtime-ready" or any(item["operation"] == "install-runtime-reference" for item in ledger["operations"]):
        raise RuntimeError("Reference installation requires initial ready runtime; no retry")
    ids, keys, facts = verify_edge(driver)
    pin_runtime(driver, facts)
    source = Path(driver.plan["checkout"]) / "tests" / "assignments" / "fixtures" / "staffing-runtime-reference.sql"
    body = read_source(source)
    service = keys["SERVICE_ROLE_KEY"]
    status, gateway = http_check(driver, "/_ci-gateway-state", keys, token=service, apikey=service)
    if status != 200 or not quiet_state(gateway):
        raise RuntimeError("Reference admission requires certain idle gateway")
    pin_gateway(driver, gateway)
    operation = driver.journal.begin("install-runtime-reference", {"kind": "schema", "name": driver.identity + "-reference", "id": driver.cid, "sha256": digest(body)})
    try:
        status, lease = http_check(driver, "/functions/v1/_local-drain", keys, token=service, apikey=service, method="POST")
        if status != 200 or lease.get("active") != 0 or lease.get("pending") != 0 or not isinstance(lease.get("lease"), str):
            raise RuntimeError("Reference admission has no proven runtime lease")
        if read_source(source) != body:
            raise RuntimeError("Reference source changed before SQL")
        verify_boots(driver, facts)
        # Exact recorded CID and local socket; one atomic SQL transaction.
        driver.sql(driver.cid, "BEGIN;\n" + body.decode() + "\nCOMMIT;")
        status, released = http_check(driver, "/functions/v1/_local-release", keys, token=service, apikey=service, method="POST", body={"lease": lease["lease"]})
        if status != 200 or released != {"released": True}:
            raise RuntimeError("Reference completion lease could not be released")
        verify_boots(driver, facts)
        private_write(driver.root / "reference-evidence.json", (json.dumps({"identity": driver.identity, "databaseId": driver.cid, "edgeId": ids["edge"], "sourceSha256": digest(body), "personalData": False}) + "\n").encode())
        driver.journal.complete(operation, {"id": driver.cid, "sha256": digest(read_source(driver.root / "reference-evidence.json"))})
    except BaseException:
        driver.journal.mark_uncertain(operation)
        raise
    _, _, final_facts = verify_edge(driver)
    pin_runtime(driver, final_facts)
