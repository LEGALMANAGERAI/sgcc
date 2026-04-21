import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rutas públicas
  const publicPaths = ["/login", "/registro", "/invitacion", "/widget", "/firmar", "/verificar", "/votar"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // API routes de auth, health y activación siempre permitidas
  // /api/partes permite POST con selfRegister sin sesión (el handler valida el resto)
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/health") || pathname.startsWith("/api/legados/activar") || pathname.startsWith("/api/widget") || pathname.startsWith("/api/firmar") || pathname.startsWith("/api/votar") || pathname === "/api/partes") {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  const unauthorized = () =>
    isApi
      ? NextResponse.json({ error: "Sesión expirada. Vuelve a iniciar sesión." }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url));

  // Sin sesión → login (o 401 si es API)
  if (!session) return unauthorized();

  const userType = (session.user as any)?.userType;

  // Portal de partes — solo partes
  if (pathname.startsWith("/mis-casos") || pathname.startsWith("/perfil") || pathname.startsWith("/nueva-solicitud")) {
    if (userType !== "party") return unauthorized();
  }

  // Portal de staff — solo staff
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/casos") ||
    pathname.startsWith("/agenda") ||
    pathname.startsWith("/partes") ||
    pathname.startsWith("/conciliadores") ||
    pathname.startsWith("/salas") ||
    pathname.startsWith("/plantillas") ||
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/configuracion") ||
    pathname.startsWith("/expediente") ||
    pathname.startsWith("/apoderados") ||
    pathname.startsWith("/correspondencia") ||
    pathname.startsWith("/vigilancia") ||
    pathname.startsWith("/firmas")
  ) {
    if (userType !== "staff") return unauthorized();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
