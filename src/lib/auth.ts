import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/normalize-email";

let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),

    // Provider para staff (admin, conciliador, secretario)
    CredentialsProvider({
      id: "staff",
      name: "Staff",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
        centerId: { label: "Centro", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email as string);
        if (!email) return null;

        const centerId = (credentials.centerId as string | undefined)?.trim() || null;

        // Cuando el staff trabaja en varios centros, la UI envía centerId para
        // desambiguar. Si no viene, aceptamos login siempre que exista una
        // sola fila activa con ese email (retrocompat para el 99% de cuentas).
        const query = getSupabase()
          .from("sgcc_staff")
          .select("*, center:sgcc_centers(id, nombre, activo)")
          .ilike("email", email)
          .eq("activo", true);

        if (centerId) query.eq("center_id", centerId);

        const { data: rows } = await query;

        if (!rows || rows.length === 0) return null;
        // Si vinieron múltiples y la UI no pasó centerId, no podemos
        // autenticar a ciegas: la UI debe ofrecer selector primero.
        if (rows.length > 1) return null;

        const staff = rows[0];
        if (!staff.password_hash) return null;

        const ok = await bcrypt.compare(
          credentials.password as string,
          staff.password_hash
        );
        if (!ok) return null;

        const center = Array.isArray(staff.center) ? staff.center[0] : staff.center;
        if (!center?.activo) return null;

        return {
          id: staff.id,
          email: staff.email,
          name: staff.nombre,
          userType: "staff",
          centerId: staff.center_id,
          sgccRol: staff.rol,
        };
      },
    }),

    // Provider para partes externas
    CredentialsProvider({
      id: "party",
      name: "Parte",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email as string);
        if (!email) return null;

        const { data: party } = await getSupabase()
          .from("sgcc_parties")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (!party || !party.password_hash || !party.email_verified) return null;

        const ok = await bcrypt.compare(
          credentials.password as string,
          party.password_hash
        );
        if (!ok) return null;

        return {
          id: party.id,
          email: party.email,
          name: [party.nombres, party.apellidos].filter(Boolean).join(" ") || party.razon_social || party.email,
          userType: "party",
          centerId: null,  // Las partes no pertenecen a un centro específico
          sgccRol: null,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: verificar que el email exista como staff o party
      if (account?.provider === "google" && user.email) {
        const db = getSupabase();
        const email = normalizeEmail(user.email);

        // Buscar primero en staff
        const { data: staff } = await db
          .from("sgcc_staff")
          .select("id, center_id, rol, nombre, activo, center:sgcc_centers(activo)")
          .ilike("email", email)
          .eq("activo", true)
          .maybeSingle();

        const center = Array.isArray(staff?.center) ? staff.center[0] : staff?.center;
        if (staff && center?.activo) return true;

        // Buscar en parties
        const { data: party } = await db
          .from("sgcc_parties")
          .select("id")
          .ilike("email", email)
          .maybeSingle();

        if (party) return true;

        // Si no existe en ninguna tabla, redirigir a registro
        return "/registro?error=google_no_account&email=" + encodeURIComponent(email);
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Credenciales: ya viene con los datos correctos
      if (user && !account?.provider) {
        token.userType = (user as any).userType;
        token.centerId = (user as any).centerId;
        token.sgccRol = (user as any).sgccRol;
      }

      // Credenciales: viene del authorize
      if (user && account?.provider !== "google") {
        token.userType = (user as any).userType;
        token.centerId = (user as any).centerId;
        token.sgccRol = (user as any).sgccRol;
      }

      // Google OAuth: buscar datos del usuario en DB
      if (account?.provider === "google" && token.email) {
        const db = getSupabase();
        const email = normalizeEmail(token.email);

        // Buscar en staff
        const { data: staff } = await db
          .from("sgcc_staff")
          .select("id, center_id, rol, nombre")
          .ilike("email", email)
          .eq("activo", true)
          .maybeSingle();

        if (staff) {
          token.sub = staff.id;
          token.name = staff.nombre;
          token.userType = "staff";
          token.centerId = staff.center_id;
          token.sgccRol = staff.rol;
          return token;
        }

        // Buscar en parties
        const { data: party } = await db
          .from("sgcc_parties")
          .select("id, nombres, apellidos, razon_social, email")
          .ilike("email", email)
          .maybeSingle();

        if (party) {
          token.sub = party.id;
          token.name = [party.nombres, party.apellidos].filter(Boolean).join(" ") || party.razon_social || party.email;
          token.userType = "party";
          token.centerId = null;
          token.sgccRol = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).userType = token.userType;
        (session.user as any).centerId = token.centerId;
        (session.user as any).sgccRol = token.sgccRol;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
});
