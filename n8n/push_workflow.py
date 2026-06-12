#!/usr/bin/env python3
"""
Push the Telegram -> AI Prospecting workflow into an existing n8n workflow,
attach the Telegram credential already linked on the existing workflow to every
Telegram node, and activate it.

Usage:
    export N8N_API_KEY="eyJ...your key..."
    python3 push_workflow.py

Optional overrides (env vars or flags):
    N8N_BASE_URL     default: https://n8n.srv1748596.hstgr.cloud
    N8N_WORKFLOW_ID  default: SAh2oCacGutz9UBL
    N8N_WORKFLOW_FILE default: telegram-prospecting-workflow.json (next to this script)

Requires only the Python 3 standard library (urllib) -- no pip installs.
"""

import json
import os
import ssl
import sys
import urllib.error
import urllib.request

BASE_URL = os.environ.get("N8N_BASE_URL", "https://n8n.srv1748596.hstgr.cloud").rstrip("/")
WORKFLOW_ID = os.environ.get("N8N_WORKFLOW_ID", "SAh2oCacGutz9UBL")
API_KEY = os.environ.get("N8N_API_KEY", "")

HERE = os.path.dirname(os.path.abspath(__file__))
WORKFLOW_FILE = os.environ.get(
    "N8N_WORKFLOW_FILE", os.path.join(HERE, "telegram-prospecting-workflow.json")
)

# Node types that authenticate with a Telegram (telegramApi) credential.
TELEGRAM_NODE_TYPES = {
    "n8n-nodes-base.telegram",
    "n8n-nodes-base.telegramTrigger",
}
TELEGRAM_CRED_TYPE = "telegramApi"

_CTX = ssl.create_default_context()


def api(method, path, body=None):
    url = f"{BASE_URL}/api/v1{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=_CTX, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        sys.exit(f"\nERROR {e.code} on {method} {path}\n{detail}\n")
    except urllib.error.URLError as e:
        sys.exit(f"\nNetwork error reaching {url}: {e.reason}\n")


def find_telegram_credential(workflow):
    """Return {'id':..., 'name':...} for the telegramApi credential already
    linked on any node of the existing workflow."""
    for node in workflow.get("nodes", []):
        creds = node.get("credentials") or {}
        tg = creds.get(TELEGRAM_CRED_TYPE)
        if tg and tg.get("id"):
            return {"id": tg["id"], "name": tg.get("name", "")}, node.get("name", "?")
    return None, None


def main():
    if not API_KEY:
        sys.exit("Set N8N_API_KEY first:  export N8N_API_KEY='eyJ...'")

    with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
        new_wf = json.load(f)

    print(f"Fetching existing workflow {WORKFLOW_ID} from {BASE_URL} ...")
    existing = api("GET", f"/workflows/{WORKFLOW_ID}")
    print(f"  Found: \"{existing.get('name', '?')}\"  "
          f"({len(existing.get('nodes', []))} node(s), active={existing.get('active')})")

    cred, src_node = find_telegram_credential(existing)
    if not cred:
        sys.exit(
            "\nNo Telegram credential found on the existing workflow's nodes.\n"
            "Open the workflow in n8n, add/select your Telegram credential on a\n"
            "Telegram node, save, then re-run this script."
        )
    print(f"  Telegram credential: \"{cred['name']}\" (id={cred['id']}) "
          f"-- taken from node \"{src_node}\"")

    # Attach that credential to every Telegram node in the new workflow.
    attached = []
    for node in new_wf["nodes"]:
        if node.get("type") in TELEGRAM_NODE_TYPES:
            node.setdefault("credentials", {})[TELEGRAM_CRED_TYPE] = {
                "id": cred["id"],
                "name": cred["name"],
            }
            attached.append(node["name"])
    print(f"  Attached credential to {len(attached)} Telegram node(s): "
          f"{', '.join(attached)}")

    # Build the update payload. The n8n public API update endpoint accepts
    # exactly these fields; extras (id/active/pinData/tags) are rejected.
    payload = {
        "name": new_wf.get("name", existing.get("name", "Telegram -> AI Prospecting")),
        "nodes": new_wf["nodes"],
        "connections": new_wf["connections"],
        "settings": new_wf.get("settings", {"executionOrder": "v1"}),
    }

    print("Pushing nodes into the workflow ...")
    api("PUT", f"/workflows/{WORKFLOW_ID}", payload)
    print("  Workflow updated.")

    print("Activating workflow ...")
    result = api("POST", f"/workflows/{WORKFLOW_ID}/activate")
    print(f"  active = {result.get('active')}")

    print("\nDone. Open it here:")
    print(f"  {BASE_URL}/workflow/{WORKFLOW_ID}")
    print("\nNOTE: 'Call CRM Webhook' still points at the placeholder URL")
    print("(https://YOUR-CRM-WEBHOOK-URL-HERE). Replace it with your GoHighLevel")
    print("Inbound Webhook URL once you've created that trigger.")


if __name__ == "__main__":
    main()
