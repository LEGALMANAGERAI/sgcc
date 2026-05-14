export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isSuperAdminSession } from "@/lib/superadmin";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!isSuperAdminSession(session)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0D2340] text-white px-8 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-200">SIGECC SuperAdmin</p>
          <h1 className="text-lg font-semibold">Panel del SaaS</h1>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-blue-200 hover:text-white border border-blue-300/30 rounded-lg px-3 py-1.5"
        >
          Volver a mi centro
        </Link>
      </header>
      <main className="p-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
