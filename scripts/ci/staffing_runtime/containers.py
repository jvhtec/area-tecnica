"""Bounded owned process execution and Docker resource admission for CI only."""
import subprocess


def owned_volume(driver, name, created_at=None):
    value = driver.observe("volume", name)
    if value["Name"] != name or value["Driver"] != "local" or value["Scope"] != "local" or value.get("Options") not in (None, {}) or value["Labels"].get("local.staffing-ci") != driver.identity:
        raise ValueError("Expected owned plain local volume")
    if not isinstance(value.get("CreatedAt"), str) or not value["CreatedAt"] or (created_at is not None and value["CreatedAt"] != created_at):
        raise ValueError("Owned volume creation identity changed")
    return value


def isolated_process(value, identity, image, network, mounts, command, environment):
    """Validate a fixed nonprivileged process before start and after completion."""
    config, host = value["Config"], value["HostConfig"]
    if value["Image"] != image["Id"] or config["Labels"].get("local.staffing-ci") != identity:
        raise ValueError("Process ownership or image failed")
    if host["NetworkMode"] != network or host.get("Privileged") or not host["ReadonlyRootfs"] or host["CapDrop"] != ["ALL"] or host.get("CapAdd") or "no-new-privileges" not in host["SecurityOpt"] or host.get("PortBindings") or host.get("PublishAllPorts") or host.get("VolumesFrom") or host.get("ExtraHosts"):
        raise ValueError("Unsafe process isolation or publication")
    if host.get("PidMode") not in (None, "") or host.get("IpcMode") not in (None, "private"):
        raise ValueError("Unexpected shared process namespace")
    observed_mounts = {}
    for item in value["Mounts"]:
        if item["Type"] == "tmpfs":
            if item["Destination"] != "/tmp":
                raise ValueError("Unexpected process tmpfs")
            continue
        if item["Destination"] in observed_mounts:
            raise ValueError("Ambiguous process mount")
        observed_mounts[item["Destination"]] = (item["Type"], item.get("Name") if item["Type"] == "volume" else item.get("Source"), item["RW"])
    if observed_mounts != mounts:
        raise ValueError("Process mounts differ from the fixed recipe")
    if (host.get("Tmpfs") or {}) != {"/tmp": "rw,nosuid,size=128m"}:
        raise ValueError("Unexpected process temporary storage")
    expected = dict(item.split("=", 1) for item in (image["Config"].get("Env") or []))
    expected.update(environment)
    observed = dict(item.split("=", 1) for item in config["Env"])
    if observed != expected or len(config["Env"]) != len(observed):
        raise ValueError("Unexpected process environment or credentials")
    if config["Cmd"] != command or config.get("Entrypoint") != image["Config"].get("Entrypoint") or (config.get("User") or "") != (image["Config"].get("User") or "") or (config.get("WorkingDir") or "") != (image["Config"].get("WorkingDir") or ""):
        raise ValueError("Unexpected process command or identity")


def run_terminal(driver, operation, name, cid, verify, timeout=180):
    """First start only. Unknown/timeout outcomes stay uncertain and retained."""
    value = verify()
    if value["Id"] != cid or value["State"]["Status"] != "created" or value["State"]["Running"] or value["State"]["StartedAt"] != "0001-01-01T00:00:00Z":
        raise RuntimeError("Owned process must be observed never-started before launch")
    entry = driver.journal.begin(operation, {"kind": "process", "name": name, "id": cid})
    try:
        with (driver.root / (operation + ".log")).open("xb") as log:
            result = subprocess.run(["docker", "start", "--attach", cid], stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
        value = verify()
        if result.returncode != 0 or value["State"]["Running"] or value["State"]["Status"] != "exited" or value["State"]["ExitCode"] != 0:
            raise RuntimeError("Owned process failed; preserve exact IDs and private diagnostics")
        driver.journal.complete(entry, {"id": cid, "exitCode": 0, "running": False})
    except BaseException:
        driver.journal.mark_uncertain(entry)
        raise


def retire_terminal(driver, operation, name, cid, verify):
    value = verify()
    if value["Id"] != cid or value["State"]["Running"] or value["State"]["Status"] != "exited" or value["State"]["ExitCode"] != 0:
        raise RuntimeError("Only the verified successful terminal process can be retired")
    driver.mutate(operation, "container", name, ["rm", cid], lambda _: {"id": cid, "removed": True})
