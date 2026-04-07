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
  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("nombre")
    .eq("id", centerId)
    .single();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <StaffSidebar centerName={center?.nombre ?? "Centro"} />
      <main className="flex-1 ml-60 p-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
