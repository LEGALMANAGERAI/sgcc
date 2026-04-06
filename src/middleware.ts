import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rutas públicas
  const publicPaths = ["/login", "/registro", "/invitacion"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // API routes de auth y activación siempre permitidas
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/legados/activar")) {
    return NextResponse.next();
  }

  // Sin sesión → login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const userType = (session.user as any)?.userType;

  // Portal de partes — solo partes
  if (pathname.startsWith("/mis-casos") || pathname.startsWith("/nueva-solicitud")) {
    if (userType !== "party") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
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
    pathname.startsWith("/vigilancia")
  ) {
    if (userType !== "staff") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
