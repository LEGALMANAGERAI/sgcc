export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { SgccLogo } from "@/components/ui/SgccLogo";

export default async function PartesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const userType = (session.user as any)?.userType;
  if (userType !== "party") redirect("/login");

  const userName = session.user?.name ?? "Parte";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0D2340] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo y navegación */}
            <div className="flex items-center gap-8">
              <Link href="/mis-casos" className="flex items-center gap-2">
                <SgccLogo size="sm" showText={false} darkBg />
              </Link>
              <nav className="hidden sm:flex items-center gap-6">
                <Link
                  href="/mis-casos"
                  className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Mis Casos
                </Link>
                <Link
                  href="/perfil"
                  className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
                >
                  Mi Perfil
                </Link>
              </nav>
            </div>

            {/* Usuario y logout */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 hidden sm:inline">
                {userName}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Navegación móvil */}
      <nav className="sm:hidden bg-[#0D2340]/95 border-t border-white/10 px-4 py-2 flex gap-4">
        <Link
          href="/mis-casos"
          className="text-gray-300 hover:text-white text-sm"
        >
          Mis Casos
        </Link>
        <Link
          href="/perfil"
          className="text-gray-300 hover:text-white text-sm"
        >
          Mi Perfil
        </Link>
      </nav>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
