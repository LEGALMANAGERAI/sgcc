import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const checks: Record<string, any> = {
    supabase_url_full: url ?? "MISSING",
    service_key_length: key?.length ?? 0,
    service_key_end: key ? key.substring(key.length - 10) : "MISSING",
    nextauth_secret: process.env.NEXTAUTH_SECRET ? "SET" : "MISSING",
    nextauth_url: process.env.NEXTAUTH_URL ?? "MISSING",
    node_version: process.version,
  };

  // Test 1: raw fetch to Supabase
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/sgcc_centers?select=id,nombre&limit=1`, {
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
      });
      const text = await res.text();
      checks.raw_fetch_status = res.status;
      checks.raw_fetch_body = text.substring(0, 200);
    } catch (e: any) {
      checks.raw_fetch_error = e.message;
      checks.raw_fetch_cause = e.cause?.message ?? "none";
    }
  }

  return NextResponse.json(checks);
}
