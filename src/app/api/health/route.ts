import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.NEXTAUTH_SECRET;

  const checks: Record<string, any> = {
    supabase_url: url ? `${url.substring(0, 30)}...` : "MISSING",
    service_key: key ? `${key.substring(0, 20)}...` : "MISSING",
    nextauth_secret: secret ? "SET" : "MISSING",
    nextauth_url: process.env.NEXTAUTH_URL ?? "MISSING",
  };

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { data, error } = await supabase
        .from("sgcc_staff")
        .select("email, nombre, rol")
        .limit(3);

      checks.db_connection = error ? `ERROR: ${error.message}` : "OK";
      checks.staff_count = data?.length ?? 0;
      checks.staff = data?.map((s: any) => `${s.email} (${s.rol})`) ?? [];
    } catch (e: any) {
      checks.db_connection = `EXCEPTION: ${e.message}`;
    }
  }

  return NextResponse.json(checks);
}
