#!/usr/bin/env python3
"""Phased, private synthetic runtime provisioning; never select a linked project."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "staffing_runtime"))
from bootstrap import Bootstrap
from plan import prepare


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
    args = parser.parse_args()
    if args.command == "prepare":
        plan = prepare(args.root, args.checkout, args.cli, args.node, args.base_port)
        print(json.dumps({"identity": plan["identity"], "phase": "sources-prepared", "migrationFiles": len(plan["migrations"]), "dockerMutations": False}))
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
