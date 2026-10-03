#!/usr/bin/env python3
"""Phased, private synthetic runtime provisioning; never select a linked project."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "staffing_runtime"))
from bootstrap import Bootstrap
from plan import prepare
from migrations import Migrations
from services import Services
from cache import Cache
from edge import Edge
from reference import install_reference
from teardown import Teardown


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    sources = commands.add_parser("prepare", help="Prepare a fresh private source/config project without services")
    sources.add_argument("--root", type=Path, required=True)
    sources.add_argument("--checkout", type=Path, required=True)
    sources.add_argument("--cli", type=Path, required=True)
    sources.add_argument("--node", type=Path, required=True)
    sources.add_argument("--base-port", type=int, required=True)
    bootstrap = commands.add_parser("bootstrap", help="Start only the empty owned DB, then isolate it and disable cron")
    bootstrap.add_argument("--root", type=Path, required=True)
    verify = commands.add_parser("verify-bootstrap", help="Observe recorded terminal bootstrap resources without relaunching")
    verify.add_argument("--root", type=Path, required=True)
    migrate = commands.add_parser("migrate", help="Replay snapshotted migrations on the same isolated empty database, without reset")
    migrate.add_argument("--root", type=Path, required=True)
    migrate.add_argument("--resume-ingress", action="store_true", help="Reconcile only the known terminal pre-SQL Windows bind-alias failure")
    services = commands.add_parser("services", help="Provision owned local Auth/REST/gateway without fixtures or Edge admission")
    services.add_argument("--root", type=Path, required=True)
    check_services = commands.add_parser("verify-services", help="Observe and verify the recorded terminal Auth/REST/gateway launch")
    check_services.add_argument("--root", type=Path, required=True)
    cache = commands.add_parser("cache", help="Compile the Edge dependency graph on a separate credential-free build network")
    cache.add_argument("--root", type=Path, required=True)
    cache.add_argument("--node", type=Path, required=True)
    for name in ["edge", "verify-edge"]:
        command = commands.add_parser(name, help="Launch or verify owned offline Edge/capture before fixture admission")
        command.add_argument("--root", type=Path, required=True)
    reference = commands.add_parser("reference", help="Install the non-personal reference catalog under verified Edge completion admission")
    reference.add_argument("--root", type=Path, required=True)
    teardown = commands.add_parser("teardown", help="Retire only the verified empty ready stack; retain uncertain outcomes and private evidence")
    teardown.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "teardown":
        Teardown(args.root).run()
        print(json.dumps({"phase": "runtime-retired", "ownedResourcesRemoved": True, "privateEvidenceRetained": True}))
    elif args.command == "prepare":
        plan = prepare(args.root, args.checkout, args.cli, args.node, args.base_port)
        print(json.dumps({"identity": plan["identity"], "phase": "sources-prepared", "migrationFiles": len(plan["migrations"]), "dockerMutations": False}))
    elif args.command == "reference":
        install_reference(args.root)
        print(json.dumps({"phase": "edge-runtime-ready", "referenceCatalogInstalled": True, "personalData": False}))
    elif args.command in ("edge", "verify-edge"):
        driver = Edge(args.root, verify_only=args.command == "verify-edge")
        driver.finish() if args.command == "verify-edge" else driver.run()
        print(json.dumps({"phase": "edge-runtime-ready", "fixturesLoaded": False, "externalNetwork": False}))
    elif args.command == "cache":
        Cache(args.root, args.node).run()
        print(json.dumps({"phase": "edge-cache-ready", "credentialsPassed": False, "handlersExecuted": False}))
    elif args.command in ("services", "verify-services"):
        driver = Services(args.root, verify_only=args.command == "verify-services")
        driver.finish() if args.command == "verify-services" else driver.run()
        print(json.dumps({"phase": "auth-rest-ready", "fixtureAdmission": False, "edgeProvisioned": False}))
    elif args.command == "migrate":
        Migrations(args.root, resume_ingress=args.resume_ingress).run()
        print(json.dumps({"phase": "isolated-schema-applied", "databaseRecreated": False, "cron": "off"}))
    else:
        driver = Bootstrap(args.root)
        if args.command == "verify-bootstrap":
            driver.finish_empty()
        else:
            driver.run()
        print(json.dumps({"phase": "empty-isolated-database", "cron": "off", "applicationMigrationsApplied": False}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Raw subprocess output and private file contents remain outside CI logs.
        print(f"Synthetic provisioning refused ({type(error).__name__}): {error}", file=sys.stderr)
        raise SystemExit(1)
