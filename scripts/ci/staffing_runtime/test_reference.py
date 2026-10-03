import json
import unittest
from unittest.mock import Mock, patch

import test_services
from reference import install_reference
from edge_checks import pin_runtime
from services import credentials


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_services.ServiceTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.driver = self.fixture.driver
        self.driver.journal.set_phase("edge-runtime-ready")
        self.source = self.fixture.fixture.checkout / "tests" / "assignments" / "fixtures" / "staffing-runtime-reference.sql"
        self.source.parent.mkdir(parents=True)
        self.source.write_bytes(b"INSERT INTO public.activity_catalog(code) VALUES ('job.created');")
        self.keys = credentials()
        self.driver.sql = Mock()
        self.driver.runtime_names = {"edge": self.driver.identity + "-edge", "capture": self.driver.identity + "-capture"}
        self.live = {kind: {"Id": str(index) * 64, "Name": "/" + name, "State": {"Running": True, "StartedAt": "original"}} for index, (kind, name) in enumerate(self.driver.runtime_names.items(), start=7)}
        self.driver.observe = lambda kind, cid: next(item for item in self.live.values() if item["Id"] == cid)

    def facts(self):
        return {kind: {"id": item["Id"], "startedAt": item["State"]["StartedAt"]} for kind, item in self.live.items()}

    def reply(self, driver, route, keys, **kwargs):
        if route == "/_ci-gateway-state":
            return 200, {"protocol": 1, "boot": "12345678-1234-1234-1234-123456789abc", "generation": 20, "active": 0, "uncertainty": 0}
        if route.endswith("_local-drain"):
            return 200, {"active": 0, "pending": 0, "lease": "owned-lease"}
        self.assertEqual(route, "/functions/v1/_local-release")
        self.assertEqual(kwargs["body"], {"lease": "owned-lease"})
        return 200, {"released": True}

    def invoke(self, reply=None):
        with patch("reference.Edge", return_value=self.driver), patch("reference.verify_edge", side_effect=lambda _: ({"edge": "7" * 64}, self.keys, self.facts())), patch("reference.pin_gateway"), patch("reference.http_check", side_effect=reply or self.reply) as http:
            install_reference(self.driver.root)
        return http

    def test_reference_is_atomic_exact_cid_and_published_only_after_release(self):
        http = self.invoke()
        cid, query = self.driver.sql.call_args.args
        self.assertEqual(cid, self.driver.cid)
        self.assertTrue(query.startswith("BEGIN;\n"))
        self.assertTrue(query.endswith("\nCOMMIT;"))
        self.assertEqual(http.call_count, 3)
        evidence = json.loads((self.driver.root / "reference-evidence.json").read_bytes())
        self.assertFalse(evidence["personalData"])
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "succeeded")
        with self.assertRaisesRegex(RuntimeError, "no retry"):
            self.invoke()
        self.assertEqual(self.driver.sql.call_count, 1)

    def test_uncertain_sql_retains_lease_and_refuses_retry(self):
        self.driver.sql.side_effect = RuntimeError("SQL transport uncertain")
        with patch("reference.http_check", side_effect=self.reply) as http, patch("reference.Edge", return_value=self.driver), patch("reference.verify_edge", side_effect=lambda _: ({"edge": "7" * 64}, self.keys, self.facts())), patch("reference.pin_gateway"), self.assertRaisesRegex(RuntimeError, "SQL transport"):
            install_reference(self.driver.root)
        self.assertEqual(http.call_count, 2)  # No release after uncertain SQL.
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")
        self.assertFalse((self.driver.root / "reference-evidence.json").exists())
        with self.assertRaises(RuntimeError): self.invoke()
        self.assertEqual(self.driver.sql.call_count, 1)

    def test_pinned_runtime_restart_refuses_reference_before_drain_or_sql(self):
        pin_runtime(self.driver, self.facts())
        self.live["edge"]["State"]["StartedAt"] = "restarted"
        reply = Mock(side_effect=self.reply)
        with self.assertRaisesRegex(RuntimeError, "restart"):
            self.invoke(reply)
        reply.assert_not_called()
        self.driver.sql.assert_not_called()

    def test_runtime_restart_under_lease_refuses_sql(self):
        def reply(driver, route, keys, **kwargs):
            value = self.reply(driver, route, keys, **kwargs)
            if route.endswith("_local-drain"):
                self.live["edge"]["State"]["StartedAt"] = "restarted"
            return value
        with self.assertRaisesRegex(RuntimeError, "boot changed"):
            self.invoke(reply)
        self.driver.sql.assert_not_called()
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")

    def test_changed_reference_after_drain_refuses_sql(self):
        def reply(driver, route, keys, **kwargs):
            result = self.reply(driver, route, keys, **kwargs)
            if route.endswith("_local-drain"):
                self.source.write_bytes(b"changed source")
            return result
        with self.assertRaisesRegex(RuntimeError, "source changed"):
            self.invoke(reply)
        self.driver.sql.assert_not_called()
        self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")

    def test_pending_workers_or_failed_release_cannot_publish_success(self):
        for fault in ["pending", "release"]:
            # Each failed run needs its own fresh journal, never clearing uncertainty.
            if fault == "release":
                self.doCleanups()
                self.setUp()
            def reply(driver, route, keys, **kwargs):
                status, value = self.reply(driver, route, keys, **kwargs)
                if fault == "pending" and route.endswith("_local-drain"): value["pending"] = 1
                if fault == "release" and route.endswith("_local-release"): status = 503
                return status, value
            with self.subTest(fault=fault), self.assertRaises(RuntimeError): self.invoke(reply)
            self.assertFalse((self.driver.root / "reference-evidence.json").exists())
            self.assertEqual(self.driver.journal.load()["operations"][-1]["state"], "uncertain")
            self.assertEqual(self.driver.sql.call_count, 0 if fault == "pending" else 1)
