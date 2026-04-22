import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "@/lib/normalize-email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 3) return NextResponse.json([]);

  const { data } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id, tipo_persona, nombres, apellidos, razon_social, email, numero_doc, nit_empresa, tipo_doc")
    .or(`email.ilike.%${q}%,numero_doc.ilike.%${q}%,nombres.ilike.%${q}%,razon_social.ilike.%${q}%`)
    .limit(10);

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // Permite registro desde portal (sin sesión) si selfRegister === true
  const body = await req.json();
  const { selfRegister } = body;

  if (!selfRegister && !session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const {
    tipo_persona,
    nombres,
    apellidos,
    razon_social,
    tipo_doc,
    numero_doc,
    email: rawEmail,
    telefono,
    password,
    invite,
    codigo_centro,
  } = body;

  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  // Resolver center_id desde código corto cuando es auto-registro desde portal
  let centerId: string | null = null;
  if (selfRegister) {
    const codigo = String(codigo_centro ?? "").trim().toUpperCase();
    if (!codigo || codigo.length !== 8) {
      return NextResponse.json(
        { error: "Código del centro inválido (8 caracteres)" },
        { status: 400 }
      );
    }
    const { data: centro } = await supabaseAdmin
      .from("sgcc_centers")
      .select("id")
      .eq("codigo_corto", codigo)
      .maybeSingle();
    if (!centro) {
      return NextResponse.json(
        { error: "No se encontró un centro con ese código" },
        { status: 404 }
      );
    }
    centerId = centro.id;
  }

  // Verificar si ya existe (case-insensitive)
  const { data: existing } = await supabaseAdmin
    .from("sgcc_parties")
    .select("id, email_verified")
    .ilike("email", email)
    .maybeSingle();

  if (existing && selfRegister) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const partyId = existing?.id ?? randomUUID();

  const data: any = {
    tipo_persona: tipo_persona ?? "natural",
    nombres: nombres || null,
    apellidos: apellidos || null,
    razon_social: razon_social || null,
    tipo_doc: tipo_doc || null,
    numero_doc: numero_doc || null,
    email,
    telefono: telefono || null,
    updated_at: now,
  };

  if (centerId) data.center_id = centerId;

  if (selfRegister && password) {
    data.password_hash = await bcrypt.hash(password, 12);
    data.email_verified = now; // Auto-verify for self-registration (simplify for now)
  }

  if (invite) {
    data.invite_token = randomUUID();
    data.invite_expires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    data.invited_at = now;
  }

  if (existing) {
    await supabaseAdmin.from("sgcc_parties").update(data).eq("id", partyId);
    return NextResponse.json({ id: partyId });
  }

  data.id = partyId;
  data.created_at = now;

  const { error } = await supabaseAdmin.from("sgcc_parties").insert(data);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: partyId }, { status: 201 });
}
