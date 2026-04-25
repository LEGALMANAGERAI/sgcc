export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { StaffSidebar } from "@/components/layout/StaffSidebar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const userType = (session.user as any)?.userType;
  if (userType !== "staff") redirect("/login");

  const centerId = (session.user as any)?.centerId;
  const sgccRol = (session.user as any)?.sgccRol as "admin" | "secretario" | "conciliador" | undefined;
  const [{ data: center }, { count: vigilanciaNoLeidas }] = await Promise.all([
    supabaseAdmin
      .from("sgcc_centers")
      .select("nombre")
      .eq("id", centerId)
      .single(),
    supabaseAdmin
      .from("sgcc_process_updates")
      .select("id, watched:sgcc_watched_processes!inner(center_id)", { count: "exact", head: true })
      .eq("leida", false)
      .eq("watched.center_id", centerId),
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StaffSidebar
        centerName={center?.nombre ?? "Centro"}
        vigilanciaNoLeidas={vigilanciaNoLeidas ?? 0}
        sgccRol={sgccRol}
      />
      <main
        data-staff-main
        className="flex-1 ml-60 p-8 max-w-7xl transition-[margin-left] duration-200 ease-out"
      >
        {children}
      </main>
    </div>
  );
}
