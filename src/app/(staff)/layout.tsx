import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
export const dynamic = "force-dynamic";
  const session = await auth();
  if (!session) redirect("/login");
export const dynamic = "force-dynamic";

  const userType = (session.user as any)?.userType;
export const dynamic = "force-dynamic";
  if (userType !== "staff") redirect("/login");

export const dynamic = "force-dynamic";
  const centerId = (session.user as any)?.centerId;
  const { data: center } = await supabaseAdmin
export const dynamic = "force-dynamic";
    .from("sgcc_centers")
    .select("nombre")
export const dynamic = "force-dynamic";
    .eq("id", centerId)
    .single();
export const dynamic = "force-dynamic";

  return (
export const dynamic = "force-dynamic";
    <div className="flex min-h-screen bg-gray-50">
      <StaffSidebar centerName={center?.nombre ?? "Centro"} />
export const dynamic = "force-dynamic";
      <main className="flex-1 ml-60 p-8 max-w-7xl">
        {children}
export const dynamic = "force-dynamic";
      </main>
    </div>
export const dynamic = "force-dynamic";
  );
}
