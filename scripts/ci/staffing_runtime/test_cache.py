import copy
import json
import subprocess
import unittest
from unittest.mock import patch

import test_services
from cache import Cache, ENTRYPOINT, tree_hashes
from containers import isolated_process, owned_volume, retire_terminal, run_terminal


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_services.ServiceTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.driver = self.fixture.driver
        self.fixture.live_fixture()
        self.driver.journal.set_phase("auth-rest-ready")
        self.plan = self.fixture.plan
        projection = self.fixture.fixture.root / "edge-source"
        (projection / "index.ts").write_bytes(b"export const fixture = true;\n")
        script = self.fixture.fixture.checkout / "scripts" / "ci" / "stage-staffing-edge.mjs"
        script.parent.mkdir(parents=True)
        script.write_bytes(b"// test stager\n")
        image = {"Id": "sha256:" + "7" * 64, "Config": {"Env": ["PATH=/test"], "Cmd": [], "Entrypoint": None, "User": None, "WorkingDir": None}}
        with patch.object(Cache, "observe", return_value=image):
            self.cache = Cache(self.fixture.fixture.root, self.fixture.fixture.node)

    def stage_child(self, args, **kwargs):
        self.cache.stage.mkdir()
        (self.cache.stage / "index.ts").write_bytes(b"export const fixture = true;\n")
        return subprocess.CompletedProcess(args, 0)

    def source(self):
        with patch("cache.verify_services"), patch("cache.subprocess.run", side_effect=self.stage_child):
            return self.cache.prepare_cache_source()

    def test_sources_restage_matching_bytes_and_include_all_compiler_entrypoints(self):
        metadata = self.source()
        self.assertEqual(tree_hashes(self.cache.stage), metadata["sourceHashes"])
        self.assertIn("cache-entrypoint.ts", metadata["sourceHashes"])
        for entry in ["main/index.ts", "_ci-probe-modern/index.ts", "_ci-probe-legacy/index.ts", "functions/staffing-orchestrator/index.ts"]:
            self.assertIn(entry.encode(), ENTRYPOINT)
        self.assertEqual(self.cache.read_cache_source(), metadata)
        self.assertNotIn("ANON_KEY", json.dumps(metadata))

    def test_changed_projection_or_failed_stager_retains_uncertainty(self):
        def changed(args, **kwargs):
            result = self.stage_child(args, **kwargs)
            (self.cache.stage / "index.ts").write_bytes(b"changed")
            return result
        with patch("cache.verify_services"), patch("cache.subprocess.run", side_effect=changed), self.assertRaisesRegex(RuntimeError, "differs"):
            self.cache.prepare_cache_source()
        self.assertEqual(self.cache.journal.load()["operations"][-1]["state"], "uncertain")
        self.assertFalse((self.cache.root / "cache.json").exists())

    def test_changed_stage_or_metadata_refuses_cached_source(self):
        self.source()
        path = self.cache.stage / "index.ts"
        original = path.read_bytes()
        path.write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "source bytes"): self.cache.read_cache_source()
        path.write_bytes(original)
        metadata = self.cache.root / "cache.json"
        metadata.write_bytes(metadata.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "metadata changed"): self.cache.read_cache_source()

    def test_existing_cache_source_and_repeat_attempt_refuse_before_child(self):
        self.source()
        with patch("cache.subprocess.run") as run, self.assertRaisesRegex(RuntimeError, "already exists"):
            self.cache.prepare_cache_source()
        run.assert_not_called()
        with patch.object(self.cache, "docker") as docker, self.assertRaisesRegex(RuntimeError, "already attempted"):
            self.cache.run()
        docker.assert_not_called()

    def test_volume_backing_creation_time_and_owner_are_required(self):
        volume = {"Name": self.cache.volumes["code"], "Driver": "local", "Scope": "local", "Options": None,
                  "Labels": {"local.staffing-ci": self.cache.identity}, "CreatedAt": "2026-10-03T00:00:00Z"}
        with patch.object(self.cache, "observe", return_value=volume):
            self.assertEqual(owned_volume(self.cache, volume["Name"], volume["CreatedAt"]), volume)
        for key, value in [("Driver", "foreign"), ("Options", {"device": "/private"}), ("CreatedAt", "replaced"), ("Labels", {"local.staffing-ci": "foreign"})]:
            changed = {**volume, key: value}
            with self.subTest(key=key), patch.object(self.cache, "observe", return_value=changed), self.assertRaises(ValueError):
                owned_volume(self.cache, volume["Name"], volume["CreatedAt"])

    def test_process_recipe_refuses_credentials_mounts_capabilities_namespaces_and_ports(self):
        image = self.cache.edge_image
        command = ["bundle", "--entrypoint", "/local/cache-entrypoint.ts"]
        mounts = {"/local": ("volume", self.cache.volumes["code"], False)}
        value = {"Image": image["Id"], "Config": {"Labels": {"local.staffing-ci": self.cache.identity}, "Env": ["PATH=/test", "DENO_DIR=/cache/deno"],
                 "Cmd": command, "Entrypoint": None, "User": "", "WorkingDir": ""},
                 "HostConfig": {"NetworkMode": "none", "Privileged": False, "ReadonlyRootfs": True, "CapDrop": ["ALL"], "CapAdd": None,
                                "SecurityOpt": ["no-new-privileges"], "PortBindings": {}, "Tmpfs": {"/tmp": "rw,nosuid,size=128m"}},
                 "Mounts": [{"Type": "volume", "Name": self.cache.volumes["code"], "Destination": "/local", "RW": False}]}
        def check(item): isolated_process(item, self.cache.identity, image, "none", mounts, command, {"DENO_DIR": "/cache/deno"})
        check(value)
        for fault in ["secret", "mount", "capability", "pid", "port", "command"]:
            changed = copy.deepcopy(value)
            if fault == "secret": changed["Config"]["Env"].append("SUPABASE_SERVICE_ROLE_KEY=not-allowed")
            if fault == "mount": changed["Mounts"][0]["RW"] = True
            if fault == "capability": changed["HostConfig"]["CapAdd"] = ["SYS_ADMIN"]
            if fault == "pid": changed["HostConfig"]["PidMode"] = "host"
            if fault == "port": changed["HostConfig"]["PortBindings"] = {"9000/tcp": []}
            if fault == "command": changed["Config"]["Cmd"] = ["start"]
            with self.subTest(fault=fault), self.assertRaises(ValueError): check(changed)

    def test_terminal_process_starts_once_and_completes_before_retirement(self):
        cid, name = "8" * 64, self.cache.identity + "-test-process"
        created = {"Id": cid, "State": {"Status": "created", "Running": False, "StartedAt": "0001-01-01T00:00:00Z"}}
        terminal = {"Id": cid, "State": {"Status": "exited", "Running": False, "ExitCode": 0}}
        with patch("containers.subprocess.run", return_value=subprocess.CompletedProcess([], 0)) as run:
            observations = iter([created, terminal])
            run_terminal(self.cache, "test-terminal", name, cid, lambda: next(observations))
        self.assertEqual(run.call_count, 1)
        self.assertEqual(self.cache.journal.load()["operations"][-1]["state"], "succeeded")
        with patch.object(self.cache, "mutate") as mutate:
            retire_terminal(self.cache, "test-retire", name, cid, lambda: terminal)
        self.assertEqual(mutate.call_args.args[3], ["rm", cid])

    def test_timeout_preserves_uncertainty_and_does_not_retry_or_remove(self):
        cid, name = "8" * 64, self.cache.identity + "-test-process"
        created = {"Id": cid, "State": {"Status": "created", "Running": False, "StartedAt": "0001-01-01T00:00:00Z"}}
        with patch("containers.subprocess.run", side_effect=subprocess.TimeoutExpired(["docker"], 180)) as run, self.assertRaises(subprocess.TimeoutExpired):
            run_terminal(self.cache, "test-timeout", name, cid, lambda: created)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(self.cache.journal.load()["operations"][-1]["state"], "uncertain")
        with patch.object(self.cache, "mutate") as mutate, self.assertRaises(RuntimeError):
            retire_terminal(self.cache, "test-retire", name, cid, lambda: created)
        mutate.assert_not_called()

    def test_previously_started_process_refused_before_launch(self):
        cid, name = "8" * 64, self.cache.identity + "-test-process"
        started = {"Id": cid, "State": {"Status": "exited", "Running": False, "StartedAt": "2026-10-03T00:00:00Z"}}
        with patch("containers.subprocess.run") as run, self.assertRaisesRegex(RuntimeError, "never-started"):
            run_terminal(self.cache, "test-repeat", name, cid, lambda: started)
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
