#!/usr/bin/env python3
"""Read-only Staffing Kanban checker.

This replaces the old chat-waking watcher.  It reads the hosted task board,
prints a compact status report, and exits non-zero on authentication, network,
or malformed-response failures.  It never starts Codex, dispatches workers, or
writes to the hosted board.

Authentication is taken from STAFFING_SITE_TOKEN first, then from the existing
macOS Keychain entry used by the Staffing tools.  The token is never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone


BOARD_URL = os.environ.get("STAFFING_BOARD_URL", "http://127.0.0.1:5173/api/tasks")
KEYCHAIN_SERVICE = "com.alexperusse.staffing-kanban-monitor"


def read_token() -> str:
    token = os.environ.get("STAFFING_SITE_TOKEN", "").strip()
    if token:
        return token
    result = subprocess.run(
        ["/usr/bin/security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
        check=True,
        capture_output=True,
        text=True,
    )
    token = result.stdout.strip()
    if not token:
        raise RuntimeError("Staffing Site token is empty")
    return token


def read_tasks(token: str) -> list[dict]:
    request = urllib.request.Request(
        BOARD_URL,
        headers={
            "Accept": "application/json",
            "OAI-Sites-Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, list) or not all(isinstance(row, dict) for row in payload):
        raise ValueError("The tasks endpoint did not return a list of task objects")
    return payload


def report(tasks: list[dict]) -> dict:
    statuses = Counter(str(task.get("status") or "Unknown") for task in tasks)
    actionable = [
        task
        for task in tasks
        if task.get("status") in {"Backlog", "Ready"}
    ]
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "boardUrl": BOARD_URL,
        "total": len(tasks),
        "byStatus": dict(sorted(statuses.items())),
        "actionable": [
            {
                "id": task.get("id"),
                "title": task.get("title"),
                "status": task.get("status"),
                "assignee": task.get("assignee"),
                "updatedAt": task.get("updatedAt", task.get("updated_at")),
            }
            for task in actionable
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Read and report the hosted Staffing Kanban")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument("--watch", type=float, metavar="SECONDS", help="Repeat at this interval")
    args = parser.parse_args()

    while True:
        try:
            result = report(read_tasks(read_token()))
        except (OSError, RuntimeError, subprocess.CalledProcessError, urllib.error.URLError,
                TimeoutError, ValueError, json.JSONDecodeError) as error:
            print(f"kanban check failed: {error}", file=sys.stderr)
            return 1

        if args.json:
            print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        else:
            counts = ", ".join(f"{key}={value}" for key, value in result["byStatus"].items())
            print(f"{result['checkedAt']} tasks={result['total']} ({counts or 'no tasks'})")
            for task in result["actionable"]:
                print(f"  {task['status']}: {task['id']} — {task['title']}")

        if args.watch is None:
            return 0
        if args.watch <= 0:
            parser.error("--watch must be greater than zero")
        time.sleep(args.watch)


if __name__ == "__main__":
    raise SystemExit(main())
