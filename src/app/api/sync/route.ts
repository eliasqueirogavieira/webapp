import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";

const REPO = "eliasqueirogavieira/webapp";
const WORKFLOW_FILE = "sync-ludopedia.yml";
const REF = "main";

const RUNS_URL = `https://github.com/${REPO}/actions/workflows/${WORKFLOW_FILE}`;

/**
 * Owner-only. Triggers the sync-ludopedia.yml workflow on GitHub via
 * workflow_dispatch. Returns immediately — the actual sync runs on GH
 * runners (~5 min). Caller can open `runs_url` to watch progress.
 */
export async function POST() {
  if (!(await isOwner())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "GH_DISPATCH_TOKEN not configured" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: REF }),
    },
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true, runs_url: RUNS_URL });
  }
  const body = await res.text();
  return NextResponse.json(
    { ok: false, status: res.status, error: body.slice(0, 500) },
    { status: 502 },
  );
}
