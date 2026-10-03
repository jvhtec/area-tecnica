import copy
import io
import json
import unittest
import urllib.error
from unittest.mock import Mock, patch

import test_plan
from journal import Journal
from service_checks import NoRedirect, http_check, pin_gateway, protocol_checks, quiet_state, verify_services
from services import IMAGES, Services, credentials, environment_bytes, validate_credentials


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_plan.PlanTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.plan = self.fixture.prepared()
        self.journal = Journal(self.fixture.root / "journal.json", self.plan["identity"])
        self.journal.load()
        self.cid, self.network_id = "a" * 64, "b" * 64
        for name, value in [("start-isolated-database", self.cid), ("create-internal-network", self.network_id)]:
            entry = self.journal.begin(name, {"kind": "container", "name": self.plan["database"]})
            self.journal.complete(entry, {"id": value})
        self.journal.set_phase("isolated-schema-applied")
        source = self.fixture.checkout / "tests" / "assignments" / "runtime" / "gateway.py"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"# test gateway source\n")
        self.driver = Services(self.fixture.root)
        self.db = {"Config": {"Env": ["POSTGRES_PASSWORD=local-driver-test"]}}
        self.images = {tag: {"Id": "sha256:" + str(index) * 64,
                      "Config": {"Env": ["PATH=/test"], "Cmd": ["test-command"], "Entrypoint": None, "User": "", "WorkingDir": ""}}
                       for index, tag in enumerate(IMAGES.values(), start=1)}

    def prepare_sources(self):
        with patch.object(self.driver, "observe", side_effect=lambda kind, tag: self.images[tag]):
            return self.driver.prepare_sources(self.db)

    def live_fixture(self):
        sources = self.prepare_sources()
        _, keys = self.driver.read_sources()
        self.ids = {kind: str(index) * 64 for index, kind in enumerate(IMAGES, start=3)}
        self.ingress_id = "6" * 64
        for operation, value in [("create-service-ingress", self.ingress_id), *[("create-" + kind + "-service", cid) for kind, cid in self.ids.items()]]:
            entry = self.driver.journal.begin(operation, {"kind": "container", "name": self.plan["database"]})
            self.driver.journal.complete(entry, {"id": value})
        environments = self.driver.environments(keys, "local-driver-test")
        containers = {}
        for kind, cid in self.ids.items():
            gateway = kind == "gateway"
            ports = {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "55820"}]} if gateway else {}
            networks = {self.driver.network: {"NetworkID": self.network_id}}
            if gateway: networks[self.driver.ingress] = {"NetworkID": self.ingress_id}
            config = copy.deepcopy(self.images[IMAGES[kind]]["Config"])
            config.update({"Env": ["PATH=/test", *[key + "=" + value for key, value in environments[kind].items()]], "Labels": {"local.staffing-ci": self.driver.identity}})
            if gateway: config["Cmd"] = ["python", "/gateway.py"]
            containers[cid] = {"Id": cid, "Name": "/" + self.driver.names[kind], "State": {"Running": True}, "Image": sources["images"][kind], "Config": config,
                "NetworkSettings": {"Networks": networks, "Ports": ports},
                "HostConfig": {"PortBindings": ports, "ReadonlyRootfs": True, "Privileged": False, "CapDrop": ["ALL"], "SecurityOpt": ["no-new-privileges"],
                               "VolumesFrom": None, "PublishAllPorts": False, "ExtraHosts": None, "NetworkMode": self.driver.network, "Tmpfs": {"/tmp": "rw,noexec,nosuid,size=16m"}},
                "Mounts": [{"Type": "bind", "RW": False, "Destination": "/gateway.py", "Source": str((self.fixture.root / "gateway.py").resolve())}] if gateway else []}
        ingress = {"Id": self.ingress_id, "Name": self.driver.ingress, "Internal": False, "Driver": "bridge", "Scope": "local", "Labels": {"local.staffing-ci": self.driver.identity}, "Containers": {self.ids["gateway"]: {}}}
        def observe(kind, name):
            return self.images[name] if kind == "image" else ingress if kind == "network" else containers[name]
        return containers, ingress, observe

    def test_credentials_are_fresh_local_signed_and_role_specific(self):
        first, second = credentials(), credentials()
        self.assertNotEqual(first, second)
        self.assertEqual(validate_credentials(first), first)
        for key in first:
            self.assertNotIn("\n", first[key])
        for key in ["ANON_KEY", "SERVICE_ROLE_KEY"]:
            changed = dict(first)
            changed[key] = second[key]
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "Invalid or expired"):
                validate_credentials(changed)
        changed = dict(first)
        changed["ANON_KEY"], changed["SERVICE_ROLE_KEY"] = changed["SERVICE_ROLE_KEY"], changed["ANON_KEY"]
        with self.assertRaises(ValueError): validate_credentials(changed)
        with patch("services.time.time", return_value=2**40), self.assertRaises(ValueError): validate_credentials(first)
        with self.assertRaises(ValueError): validate_credentials({**first, "remote": "denied"})

    def test_environment_rejects_multiline_and_non_string_values(self):
        self.assertEqual(environment_bytes({"LOCAL_KEY": "test"}), b"LOCAL_KEY=test\n")
        for value in [{"LOCAL_KEY": "test\nsecret"}, {"LOCAL_KEY": "test\rsecret"}, {"bad=key": "test"}, {"LOCAL_KEY": 1}]:
            with self.subTest(value=value), self.assertRaises(ValueError): environment_bytes(value)

    def test_prepared_sources_are_private_hashed_and_exclude_credentials_from_journal(self):
        self.prepare_sources()
        _, keys = self.driver.read_sources()
        ledger = (self.fixture.root / "journal.json").read_text(encoding="utf8")
        for secret in keys.values(): self.assertNotIn(secret, ledger)
        body = (self.fixture.root / "credentials.json").read_bytes()
        (self.fixture.root / "credentials.json").write_bytes(body + b" ")
        with self.assertRaisesRegex(ValueError, "Private service source changed"):
            self.driver.read_sources()

    def test_changed_gateway_and_source_metadata_refuse_admission(self):
        self.prepare_sources()
        body = self.driver.gateway_source.read_bytes()
        self.driver.gateway_source.write_bytes(body + b"changed")
        with self.assertRaisesRegex(ValueError, "Public gateway changed"): self.driver.read_sources()
        self.driver.gateway_source.write_bytes(body)
        path = self.fixture.root / "services.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "metadata changed"): self.driver.read_sources()

    def test_failed_source_write_retains_uncertainty_without_resource_launch(self):
        with patch.object(self.driver, "observe", side_effect=lambda kind, tag: self.images[tag]), patch("services.private_write", side_effect=OSError("test write failure")), self.assertRaises(OSError):
            self.driver.prepare_sources(self.db)
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")

    def test_role_authentication_only_uses_recorded_local_database_and_read_only_query(self):
        with patch.object(self.driver, "docker", return_value=b"t") as docker:
            self.driver.role_readiness(self.db)
        self.assertEqual(docker.call_count, 2)
        for call in docker.call_args_list:
            self.assertIn(self.cid, call.args)
            self.assertIn("127.0.0.1", call.args)
            self.assertTrue(call.args[-1].startswith("SELECT current_user="))
        with patch.object(self.driver, "docker", return_value=b"f"), self.assertRaises(RuntimeError):
            self.driver.role_readiness(self.db)

    def test_service_recipe_uses_only_local_database_and_no_external_delivery(self):
        keys = credentials()
        environments = self.driver.environments(keys, "quoted:@/{password}")
        for kind, role in [("auth", "supabase_auth_admin"), ("rest", "authenticator")]:
            uri = environments[kind]["GOTRUE_DB_DATABASE_URL" if kind == "auth" else "PGRST_DB_URI"]
            self.assertTrue(uri.startswith("postgres://" + role + ":quoted%3A%40%2F%7Bpassword%7D@" + self.driver.database))
        self.assertEqual(environments["gateway"]["CI_CONTROL_TOKEN"], keys["CONTROL_TOKEN"])
        self.assertEqual(environments["auth"]["GOTRUE_SMTP_HOST"], self.driver.identity + "-no-mail")
        self.assertFalse(any("supabase.co" in value for env in environments.values() for value in env.values()))

    def test_live_service_admission_accepts_exact_owned_facts_and_refuses_faults(self):
        containers, ingress, observe = self.live_fixture()
        base = copy.deepcopy(containers)
        def check():
            with patch.object(self.driver, "verify_database", return_value=self.db), patch.object(self.driver, "observe", side_effect=observe), patch.object(self.driver, "docker", return_value=self.driver.gateway_source.read_bytes().strip()):
                verify_services(self.driver)
        check()
        for fault in ["id", "name", "image", "owner", "stopped", "network", "port", "privilege", "mount", "environment", "command", "user", "directory", "capability"]:
            containers.clear(); containers.update(copy.deepcopy(base))
            rest = containers[self.ids["rest"]]
            if fault == "id": rest["Id"] = "f" * 64
            if fault == "name": rest["Name"] = "/foreign"
            if fault == "image": rest["Image"] = "sha256:" + "f" * 64
            if fault == "owner": rest["Config"]["Labels"]["local.staffing-ci"] = "foreign"
            if fault == "stopped": rest["State"]["Running"] = False
            if fault == "network": rest["NetworkSettings"]["Networks"][self.driver.network]["NetworkID"] = "f" * 64
            if fault == "port": rest["HostConfig"]["PortBindings"] = {"3000/tcp": [{"HostIp": "0.0.0.0", "HostPort": "3000"}]}
            if fault == "privilege": rest["HostConfig"]["Privileged"] = True
            if fault == "mount": rest["Mounts"] = [{"Type": "volume", "Destination": "/data"}]
            if fault == "environment": rest["Config"]["Env"].append("HTTP_PROXY=foreign")
            if fault == "command": rest["Config"]["Cmd"] = ["foreign"]
            if fault == "user": rest["Config"]["User"] = "root"
            if fault == "directory": rest["Config"]["WorkingDir"] = "/foreign"
            if fault == "capability": rest["HostConfig"]["CapAdd"] = ["SYS_ADMIN"]
            with self.subTest(fault=fault), self.assertRaises(ValueError): check()
        containers.clear(); containers.update(base)
        ingress["Containers"]["f" * 64] = {}
        with self.assertRaisesRegex(ValueError, "membership"): check()

    def test_docker_empty_image_user_and_directory_normalization_is_allowed(self):
        containers, _, observe = self.live_fixture()
        for image in self.images.values():
            image["Config"]["User"] = None
            image["Config"]["WorkingDir"] = None
        with patch.object(self.driver, "verify_database", return_value=self.db), patch.object(self.driver, "observe", side_effect=observe), patch.object(self.driver, "docker", return_value=self.driver.gateway_source.read_bytes().strip()):
            verify_services(self.driver)

    def test_new_database_network_refuses_before_schema_or_launch(self):
        with patch.object(self.driver, "verify_db", return_value=(self.db, {"Id": "f" * 64})), patch.object(self.driver, "verify_schema") as schema, self.assertRaisesRegex(ValueError, "network replaced"):
            self.driver.verify_database()
        schema.assert_not_called()

    def test_repeated_provisioning_refused_before_docker(self):
        self.prepare_sources()
        with patch.object(self.driver, "docker") as docker, self.assertRaisesRegex(RuntimeError, "already attempted"):
            self.driver.run()
        docker.assert_not_called()

    def test_http_checks_ignore_environment_proxies_and_refuse_redirects_or_transport_failure(self):
        keys = credentials()
        response = io.BytesIO(b"[]")
        response.status = 200
        opener = Mock()
        opener.open.return_value = response
        with patch("service_checks.urllib.request.build_opener", return_value=opener) as build:
            self.assertEqual(http_check(self.driver, "/rest/v1/jobs", keys), (200, []))
        self.assertEqual(build.call_args.args[0].proxies, {})
        self.assertIsInstance(build.call_args.args[1], NoRedirect)
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, None, None, "https://foreign"))
        opener.open.side_effect = urllib.error.URLError("private diagnostics must not escape")
        with patch("service_checks.urllib.request.build_opener", return_value=opener), self.assertRaisesRegex(RuntimeError, "^Local service HTTP observation failed$"):
            http_check(self.driver, "/auth/v1/health", keys)

    def test_protocol_probes_do_not_call_unprovisioned_edge_or_create_users(self):
        self.live_fixture()
        keys = credentials()
        boot = "12345678-1234-1234-1234-123456789abc"
        initial = {"protocol": 1, "active": 0, "uncertainty": 0, "boot": boot, "generation": 0}
        outputs = [(200, initial), (200, {"version": "v2.186.0"}),
                   (200, {"external": {"email": True, "phone": False}, "mailer_autoconfirm": True}), (200, {"users": []}),
                   (403, {}), (200, []), (401, {"code": "PGRST301"}), (401, None), (401, None), (404, None),
                   (400, {"error_code": "invalid_credentials"}), (200, {**initial, "generation": 14})]
        with patch("service_checks.http_check", side_effect=outputs) as http:
            self.assertEqual(len(protocol_checks(self.driver, keys)), 12)
        self.assertFalse(any(call.args[1].startswith("/functions/") for call in http.call_args_list))
        posts = [call for call in http.call_args_list if call.kwargs.get("method") == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0].args[1], "/auth/v1/token?grant_type=password")
        for fault in [{"uncertainty": 1}, {"boot": "22345678-1234-1234-1234-123456789abc"}, {"generation": 0}]:
            outputs[-1] = (200, {**initial, "generation": 14, **fault})
            with self.subTest(fault=fault), patch("service_checks.http_check", side_effect=outputs), self.assertRaisesRegex(RuntimeError, "terminal gateway idle"):
                protocol_checks(self.driver, keys)

    def test_gateway_affinity_survives_verification_attempts_and_refuses_restart(self):
        self.live_fixture()
        initial = {"protocol": 1, "active": 0, "uncertainty": 0, "boot": "12345678-1234-1234-1234-123456789abc", "generation": 20}
        self.assertTrue(quiet_state(initial))
        pin_gateway(self.driver, initial)
        pin_gateway(self.driver, {**initial, "generation": 34})
        for state in [{**initial, "generation": 0}, {**initial, "boot": "22345678-1234-1234-1234-123456789abc"}]:
            with self.subTest(state=state), self.assertRaisesRegex(RuntimeError, "restart or accounting reset"):
                pin_gateway(self.driver, state)
        for state in [{**initial, "generation": True}, {**initial, "boot": "invalid"}, {**initial, "active": 1}, {**initial, "uncertainty": 1}]:
            self.assertFalse(quiet_state(state))
        path = self.fixture.root / "gateway-affinity.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "affinity evidence changed"):
            pin_gateway(self.driver, initial)


if __name__ == "__main__":
    unittest.main()
