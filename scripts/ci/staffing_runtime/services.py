"""Provision local Auth/REST/gateway; no fixtures, providers or Edge admission."""
import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from pathlib import Path
from urllib.parse import quote

from bootstrap import Bootstrap
from journal import unique_object
from migrations import Migrations
from plan import private_write, read_source

# Match the actual reviewed runtime, not the excluded CLI REST metadata.
IMAGES = {"auth": "public.ecr.aws/supabase/gotrue:v2.186.0",
          "rest": "public.ecr.aws/supabase/postgrest:v14.13", "gateway": "python:3.13-slim"}


def digest(body):
    return hashlib.sha256(body).hexdigest()


def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def credentials():
    secret, now = secrets.token_hex(32), int(time.time())
    value = {"JWT_SECRET": secret, "CONTROL_TOKEN": secrets.token_hex(32)}
    for key, role in [("ANON_KEY", "anon"), ("SERVICE_ROLE_KEY", "service_role")]:
        unsigned = encode({"alg": "HS256", "typ": "JWT"}) + "." + encode(
            {"iss": "supabase-demo", "role": role, "aud": "authenticated", "iat": now, "exp": now + 86400})
        signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), unsigned.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        value[key] = unsigned + "." + signature
    return value


def validate_credentials(value):
    if set(value) != {"JWT_SECRET", "CONTROL_TOKEN", "ANON_KEY", "SERVICE_ROLE_KEY"}:
        raise ValueError("Unexpected local credential fields")
    for key in ["JWT_SECRET", "CONTROL_TOKEN"]:
        if not isinstance(value[key], str) or not re.fullmatch(r"[a-f0-9]{64}", value[key]):
            raise ValueError("Invalid local secret format")
    for key, role in [("ANON_KEY", "anon"), ("SERVICE_ROLE_KEY", "service_role")]:
        try:
            header, payload, signature = value[key].split(".")
            decode = lambda part: json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)), object_pairs_hook=unique_object)
            claims = decode(payload)
            expected = base64.urlsafe_b64encode(hmac.new(value["JWT_SECRET"].encode(), (header + "." + payload).encode(), hashlib.sha256).digest()).decode().rstrip("=")
            valid = decode(header) == {"alg": "HS256", "typ": "JWT"} and hmac.compare_digest(expected, signature)
            valid = valid and set(claims) == {"iss", "role", "aud", "iat", "exp"} and claims["iss"] == "supabase-demo" and claims["role"] == role and claims["aud"] == "authenticated"
            valid = valid and type(claims["iat"]) is int and type(claims["exp"]) is int and claims["iat"] <= int(time.time()) < claims["exp"] and claims["exp"] - claims["iat"] == 86400
        except (ValueError, TypeError, KeyError):
            valid = False
        if not valid:
            raise ValueError("Invalid or expired local credential")
    return value


def environment_bytes(value):
    if any(not re.fullmatch(r"[A-Z_]+", key) or not isinstance(item, str) or "\n" in item or "\r" in item for key, item in value.items()):
        raise ValueError("Invalid private service environment")
    return ("\n".join(key + "=" + item for key, item in value.items()) + "\n").encode()


class Services(Bootstrap):
    def __init__(self, root, verify_only=False):
        phase = ("auth-rest-awaiting-verification", "auth-rest-ready") if verify_only else "isolated-schema-applied"
        super().__init__(root, expected_phase=phase, allow_migrations=True)
        self.cid = self.recorded_id("start-isolated-database")
        self.network_id = self.recorded_id("create-internal-network")
        self.ingress = self.identity + "-ingress"
        self.names = {kind: self.identity + "-" + kind for kind in IMAGES}
        self.url = "http://127.0.0.1:" + str(self.plan["basePort"])
        self.gateway_source = Path(self.plan["checkout"]) / "tests" / "assignments" / "runtime" / "gateway.py"

    def verify_schema(self):
        Migrations.verify_schema(self)

    def verify_database(self, members=None):
        db, network = self.verify_db(self.cid, True, members=members)
        if network["Id"] != self.network_id:
            raise ValueError("Service database network replaced")
        self.verify_schema()
        return db

    def database_password(self, db):
        environment = dict(item.split("=", 1) for item in db["Config"]["Env"])
        value = environment.get("POSTGRES_PASSWORD")
        if not value or "\r" in value or "\n" in value:
            raise ValueError("Invalid local database password")
        return value

    def role_readiness(self, db):
        password = self.database_password(db)
        for role in ["authenticator", "supabase_auth_admin"]:
            result = self.docker("exec", "-e", "PGPASSWORD=" + password, self.cid, "psql", "--no-password",
                                 "-h", "127.0.0.1", "-XqAt", "-v", "ON_ERROR_STOP=1", "-U", role, "-d", "postgres",
                                 "-c", "SELECT current_user='" + role + "';")
            if result != b"t":
                raise RuntimeError("Local service database role authentication failed")

    def environments(self, keys, password):
        db_url = "postgres://{role}:" + quote(password, safe="") + "@" + self.database + ":5432/postgres"
        return {
            "auth": {"GOTRUE_API_HOST": "0.0.0.0", "GOTRUE_API_PORT": "9999", "API_EXTERNAL_URL": self.url + "/auth/v1",
                     "GOTRUE_DB_DRIVER": "postgres", "GOTRUE_DB_DATABASE_URL": db_url.format(role="supabase_auth_admin"),
                     "GOTRUE_DB_NAMESPACE": "auth", "GOTRUE_SITE_URL": self.url, "GOTRUE_URI_ALLOW_LIST": self.url,
                     "GOTRUE_JWT_SECRET": keys["JWT_SECRET"], "GOTRUE_JWT_EXP": "3600", "GOTRUE_JWT_AUD": "authenticated",
                     "GOTRUE_JWT_ADMIN_ROLES": "service_role", "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated",
                     "GOTRUE_JWT_ISSUER": self.url + "/auth/v1", "GOTRUE_DISABLE_SIGNUP": "false",
                     "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true", "GOTRUE_EXTERNAL_PHONE_ENABLED": "false",
                     "GOTRUE_MAILER_AUTOCONFIRM": "true", "GOTRUE_SMTP_HOST": self.identity + "-no-mail",
                     "GOTRUE_SMTP_PORT": "1025", "GOTRUE_SMTP_ADMIN_EMAIL": "local-only@example.invalid", "GOTRUE_LOG_LEVEL": "error"},
            "rest": {"PGRST_DB_URI": db_url.format(role="authenticator"), "PGRST_DB_SCHEMAS": "public",
                     "PGRST_DB_ANON_ROLE": "anon", "PGRST_JWT_SECRET": keys["JWT_SECRET"], "PGRST_SERVER_PORT": "3000",
                     "PGRST_LOG_LEVEL": "error", "PGRST_DB_EXTRA_SEARCH_PATH": "public,extensions"},
            "gateway": {"CI_STACK_ID": self.identity, "CI_ANON_KEY": keys["ANON_KEY"],
                        "CI_SERVICE_KEY": keys["SERVICE_ROLE_KEY"], "CI_CONTROL_TOKEN": keys["CONTROL_TOKEN"]}}

    def prepare_sources(self, db):
        images = {kind: self.observe("image", tag)["Id"] for kind, tag in IMAGES.items()}
        gateway = read_source(self.gateway_source)
        keys = validate_credentials(credentials())
        environments = self.environments(keys, self.database_password(db))
        bodies = {"credentials.json": (json.dumps(keys) + "\n").encode(), "gateway.py": gateway}
        bodies.update({kind + ".env": environment_bytes(value) for kind, value in environments.items()})
        metadata = {"identity": self.identity, "images": images, "hashes": {name: digest(body) for name, body in bodies.items()}}
        operation = self.journal.begin("prepare-service-sources", {"kind": "source", "name": self.identity + "-service-sources"})
        try:
            for name, body in bodies.items():
                private_write(self.root / name, body)
            private_write(self.root / "services.json", (json.dumps(metadata) + "\n").encode())
            self.journal.complete(operation, {"sha256": digest(read_source(self.root / "services.json"))})
        except BaseException:
            self.journal.mark_uncertain(operation)
            raise
        return metadata

    def read_sources(self):
        ledger = self.journal.load()
        self.journal._clear(ledger)
        entries = [item for item in ledger["operations"] if item["operation"] == "prepare-service-sources"]
        body = read_source(self.root / "services.json")
        if len(entries) != 1 or entries[0]["observation"].get("sha256") != digest(body):
            raise ValueError("Service source metadata changed")
        value = json.loads(body, object_pairs_hook=unique_object)
        names = {"credentials.json", "gateway.py", "auth.env", "rest.env", "gateway.env"}
        if set(value) != {"identity", "images", "hashes"} or value["identity"] != self.identity or set(value["images"]) != set(IMAGES) or set(value["hashes"]) != names:
            raise ValueError("Invalid service source metadata")
        for name, expected in value["hashes"].items():
            if digest(read_source(self.root / name)) != expected:
                raise ValueError("Private service source changed")
        if read_source(self.root / "gateway.py") != read_source(self.gateway_source):
            raise ValueError("Public gateway changed before service admission")
        keys = validate_credentials(json.loads(read_source(self.root / "credentials.json"), object_pairs_hook=unique_object))
        return value, keys

    def run(self):
        if any(item["operation"] == "prepare-service-sources" for item in self.journal.load()["operations"]):
            raise RuntimeError("Service provisioning already attempted; no automatic retry")
        db = self.verify_database()
        self.role_readiness(db)
        for kind, name in [("network", self.ingress), *[("container", name) for name in self.names.values()]]:
            output = self.docker(kind, "ls", "--filter", "name=" + name, "--format", "{{.Name}}" if kind == "network" else "{{.Names}}")
            if output:
                raise RuntimeError("Existing service resource; refuse reuse")
        sources = self.prepare_sources(db)
        proof = self.mutate("create-service-ingress", "network", self.ingress,
                            ["network", "create", "--label", "local.staffing-ci=" + self.identity, self.ingress],
                            lambda result: {"id": result.decode(), "internal": False})
        ingress_id, ids = proof["id"], {}
        for kind, name in self.names.items():
            args = ["create", "--pull=never", "--name", name, "--network", self.network, "--label", "local.staffing-ci=" + self.identity,
                    "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
                    "--env-file", str((self.root / (kind + ".env")).resolve())]
            if kind == "gateway":
                args += ["--mount", f"type=bind,src={(self.root / 'gateway.py').resolve()},dst=/gateway.py,readonly",
                         "-p", f"127.0.0.1:{self.plan['basePort']}:8000"]
            args += [sources["images"][kind]]
            if kind == "gateway":
                args += ["python", "/gateway.py"]
            proof = self.mutate("create-" + kind + "-service", "container", name, args,
                                lambda result, image=sources["images"][kind]: {"id": result.decode(), "image": image})
            ids[kind] = proof["id"]
        self.mutate("connect-service-ingress", "container", self.names["gateway"], ["network", "connect", ingress_id, ids["gateway"]],
                    lambda _: {"id": ids["gateway"], "networkId": ingress_id})
        for kind, cid in ids.items():
            self.mutate("start-" + kind + "-service", "container", self.names[kind], ["start", cid],
                        lambda _, cid=cid: {"id": cid, "running": self.observe("container", cid)["State"]["Running"]})
        self.journal.set_phase("auth-rest-awaiting-verification")
        self.finish()

    def finish(self):
        from service_checks import finish_services
        finish_services(self)
