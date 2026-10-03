import copy
import json
import unittest
from unittest.mock import Mock, patch

import test_services
from edge import Edge
from edge_checks import healthy, pin_runtime, protocol_checks, runtime_recipe
from services import credentials, environment_bytes


class EdgeTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_services.ServiceTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.driver = self.fixture.driver
        self.keys = credentials()
        self.driver.runtime_environment = lambda keys, secret: Edge.runtime_environment(self.driver, keys, secret)
        self.driver.volumes = {"code": self.driver.identity + "-code", "cache": self.driver.identity + "-cache"}
        self.driver.helper_image = {"Id": "sha256:" + "7" * 64}
        self.driver.edge_image = {"Id": "sha256:" + "8" * 64}

    def test_edge_environment_is_local_only_and_exactly_rederived(self):
        env = self.driver.runtime_environment(self.keys, "a" * 64)
        path = self.driver.root / "edge.env"
        path.write_bytes(environment_bytes(env))
        image, command, mounts, observed = runtime_recipe(self.driver, "edge", self.keys)
        self.assertEqual(observed, env)
        self.assertEqual(image, self.driver.edge_image)
        self.assertEqual(command[-1], "per_worker")
        self.assertFalse(mounts["/local"][2])
        self.assertTrue(mounts["/cache"][2])
        self.assertEqual(env["SUPABASE_URL"], "http://" + self.driver.identity + "-gateway:8000")
        self.assertEqual(env["BREVO_API_KEY"], "CI_DUMMY_ONLY")
        for changed in [{**env, "SUPABASE_URL": "https://hosted.invalid"}, {**env, "UNREVIEWED_SECRET": "test"}, {**env, "STAFFING_TOKEN_SECRET": "short"}]:
            path.write_bytes(environment_bytes(changed))
            with self.subTest(changed=list(changed)), self.assertRaises(ValueError):
                runtime_recipe(self.driver, "edge", self.keys)
        path.write_bytes(environment_bytes(env) + b"JWT_SECRET=duplicate\n")
        with self.assertRaises(ValueError): runtime_recipe(self.driver, "edge", self.keys)

    def test_capture_recipe_has_no_database_or_provider_credentials(self):
        _, command, mounts, env = runtime_recipe(self.driver, "capture", self.keys)
        self.assertEqual(set(env), {"CI_STACK_ID", "CI_CONTROL_TOKEN"})
        self.assertEqual(command, ["python", "/capture.py"])
        self.assertEqual(set(mounts), {"/capture.py"})
        self.assertFalse(mounts["/capture.py"][2])

    def test_changed_live_code_prevents_credential_preparation_and_container_launch(self):
        self.driver.runtime_names = {"edge": self.driver.identity + "-edge", "capture": self.driver.identity + "-capture"}
        self.driver.cached_sources = lambda: {"sourceHashes": {"main/index.ts": "a" * 64}}
        self.driver.admit_code_before_launch = lambda: Edge.admit_code_before_launch(self.driver)
        self.driver.prepare_runtime = Mock()
        self.driver.mutate = Mock()
        log = self.driver.root / "source-admission.log"
        log.write_text(json.dumps({"sourceHashes": {"main/index.ts": "b" * 64}}), encoding="utf8")
        with patch("edge.verify_services"), patch.object(self.driver, "docker", return_value=b""), patch("edge.Cache.process", return_value=log) as inspector, self.assertRaisesRegex(ValueError, "before credential"):
            Edge.run(self.driver)
        self.driver.prepare_runtime.assert_not_called()
        self.driver.mutate.assert_not_called()
        self.assertEqual(inspector.call_args.args[1], "edge-source-admission")
        self.assertFalse(inspector.call_args.args[3]["/local"][2])

    def test_completed_mismatched_inspection_cannot_launch_another_inspector(self):
        operation = self.driver.journal.begin("create-edge-source-admission", {"kind": "container", "name": self.driver.identity + "-edge-source-admission"})
        self.driver.journal.complete(operation, {"id": "9" * 64})
        with patch.object(self.driver, "docker") as docker, patch.object(self.driver, "mutate") as mutate, self.assertRaisesRegex(RuntimeError, "already attempted"):
            Edge.run(self.driver)
        docker.assert_not_called()
        mutate.assert_not_called()

    def test_runtime_affinity_rejects_same_id_restart_or_replacement(self):
        original = {"edge": {"id": "7" * 64, "startedAt": "2026-10-03T12:00:00Z"}, "capture": {"id": "8" * 64, "startedAt": "2026-10-03T12:00:00Z"}}
        pin_runtime(self.driver, original)
        pin_runtime(self.driver, copy.deepcopy(original))
        for role in original:
            for field, replacement in [("id", "9" * 64), ("startedAt", "2026-10-03T13:00:00Z")]:
                changed = copy.deepcopy(original)
                changed[role][field] = replacement
                with self.subTest(role=role, field=field), self.assertRaisesRegex(RuntimeError, "restart"):
                    pin_runtime(self.driver, changed)

    def test_runtime_affinity_file_cannot_be_rewritten_to_admit_restart(self):
        original = {"edge": {"id": "7" * 64, "startedAt": "first"}}
        pin_runtime(self.driver, original)
        (self.driver.root / "edge-affinity.json").write_text(json.dumps({"edge": {"id": "7" * 64, "startedAt": "replacement"}}), encoding="utf8")
        with self.assertRaises(RuntimeError): pin_runtime(self.driver, original)

    def test_failed_affinity_publication_retains_uncertainty(self):
        with patch("edge_checks.private_write", side_effect=OSError("publication failed")), self.assertRaises(OSError):
            pin_runtime(self.driver, {"edge": {"id": "7" * 64, "startedAt": "first"}})
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")
        with self.assertRaisesRegex(RuntimeError, "Outstanding"):
            pin_runtime(self.driver, {})

    def test_health_rejects_unsafe_leased_inflight_or_missing_workers(self):
        health = {"runtime": "isolated-local", "target": "synthetic-ci", "drain_protocol": 1, "unsafe": False, "leased": False, "foreground": 0, "generation": 19, "workers": 7}
        self.assertTrue(healthy(health, 7))
        for key, value in [("unsafe", True), ("leased", True), ("foreground", 1), ("foreground", False), ("workers", 5), ("workers", True), ("generation", -1), ("target", "historical")]:
            with self.subTest(key=key):
                self.assertFalse(healthy({**health, key: value}, 7))

    def protocol_reply(self, _driver, route, _keys, **kwargs):
        if route.endswith("_local-health"):
            return 200, {"runtime": "isolated-local", "target": "synthetic-ci", "drain_protocol": 1, "unsafe": False, "leased": False, "foreground": 0, "generation": 19, "workers": 7}
        if route.endswith("_local-bootstrap"): return 200, {"bootstrapped": 5}
        if "manage-flex" in route:
            self.assertEqual(kwargs["token"], "invalid")
            return 401, {}
        if "mode=status500" in route: return 500, {"handled": True}
        if "mode=status503" in route: return 503, {"handled": True}
        if "mode=nested" in route: return 200, {"nested": 503}
        if route.endswith("_local-drain"): return 200, {"runtime": "isolated-local", "drain_protocol": 1, "active": 0, "pending": 0, "lease": "owned-lease"}
        if route.endswith("_local-release"):
            return (200, {"released": True}) if kwargs["body"]["lease"] == "owned-lease" else (409, {})
        if route == "/_ci-capture/state": return 200, {"captured": 0, "kinds": [], "blocked": 0}
        if route == "/_ci-gateway-state": return 200, {"protocol": 1, "boot": "12345678-1234-1234-1234-123456789abc", "generation": 20, "active": 0, "uncertainty": 0}
        raise AssertionError("Unexpected probe")

    def test_protocol_requires_real_bootstrap_errors_nested_completion_and_lease_denial(self):
        with patch("edge_checks.http_check", side_effect=self.protocol_reply) as probe:
            proofs, _, _ = protocol_checks(self.driver, self.keys)
        self.assertEqual(len(proofs), 13)
        self.assertEqual(probe.call_count, 13)
        self.assertIn("completion fence over actual workers", [item["name"] for item in proofs])

    def test_protocol_rejects_drain_uncertainty_and_incorrect_lease_release(self):
        for fault in ["pending", "release", "bootstrap", "gateway"]:
            def reply(driver, route, keys, **kwargs):
                status, value = self.protocol_reply(driver, route, keys, **kwargs)
                if fault == "pending" and route.endswith("_local-drain"): value["pending"] = 1
                if fault == "release" and route.endswith("_local-release") and kwargs["body"]["lease"] == "invalid": status = 200
                if fault == "bootstrap" and route.endswith("_local-bootstrap"): value["bootstrapped"] = 4
                if fault == "gateway" and route == "/_ci-gateway-state": value["uncertainty"] = 1
                return status, value
            with self.subTest(fault=fault), patch("edge_checks.http_check", side_effect=reply), self.assertRaises(RuntimeError):
                protocol_checks(self.driver, self.keys)
