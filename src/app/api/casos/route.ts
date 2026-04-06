import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, generateRadicado, addBusinessDays } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const materia = searchParams.get("materia");

  let query = supabaseAdmin
    .from("sgcc_cases")
    .select(`
      id, numero_radicado, materia, estado, cuantia, cuantia_indeterminada,
      fecha_solicitud, fecha_audiencia, created_at,
      conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre),
      partes:sgcc_case_parties(
        rol, party:sgcc_parties(nombres, apellidos, razon_social, email)
      )
    `)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (materia) query = query.eq("materia", materia);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const {
    materia,
    descripcion,
    cuantia,
    cuantia_indeterminada,
    conciliador_id,
    sala_id,
    partes,
  } = body;

  if (!materia || !descripcion || !partes?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const convocante = partes.find((p: any) => p.rol === "convocante");
  if (!convocante) {
    return NextResponse.json({ error: "Se requiere al menos un convocante" }, { status: 400 });
  }

  const convocados = partes.filter((p: any) => p.rol === "convocado");
  if (!convocados.length) {
    return NextResponse.json({ error: "Se requiere al menos un convocado" }, { status: 400 });
  }

  // Generar radicado
  const numero_radicado = await generateRadicado(centerId);
  const caseId = randomUUID();

  // Insertar caso
  const { data: caso, error: caseError } = await supabaseAdmin
    .from("sgcc_cases")
    .insert({
      id: caseId,
      center_id: centerId,
      numero_radicado,
      materia,
      descripcion,
      cuantia: cuantia ?? null,
      cuantia_indeterminada: cuantia_indeterminada ?? false,
      conciliador_id: conciliador_id ?? null,
      sala_id: sala_id ?? null,
      estado: "solicitud",
      fecha_solicitud: new Date().toISOString().split("T")[0],
      created_by_staff: (session.user as any).id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });

  // Crear o encontrar partes y vincular al caso
  const casePartyRecords: any[] = [];

  for (const p of partes) {
    // Buscar parte existente por email
    let { data: party } = await supabaseAdmin
      .from("sgcc_parties")
      .select("id")
      .eq("email", p.email)
      .single();

    if (!party) {
      // Crear la parte (sin contraseña — será invitada)
      const partyId = randomUUID();
      const now = new Date().toISOString();
      const inviteToken = randomUUID();
      const inviteExpires = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin.from("sgcc_parties").insert({
        id: partyId,
        tipo_persona: p.tipo_persona,
        nombres: p.nombres || null,
        apellidos: p.apellidos || null,
        razon_social: p.razon_social || null,
        nit_empresa: p.tipo_persona === "juridica" ? p.numero_doc : null,
        tipo_doc: p.tipo_persona === "natural" ? p.tipo_doc : null,
        numero_doc: p.tipo_persona === "natural" ? p.numero_doc : null,
        email: p.email,
        telefono: p.telefono || null,
        invite_token: inviteToken,
        invite_expires: inviteExpires,
        invited_at: now,
        created_at: now,
        updated_at: now,
      });

      party = { id: partyId };
    }

    // Vincular al caso
    casePartyRecords.push({
      id: randomUUID(),
      case_id: caseId,
      party_id: party.id,
      rol: p.rol,
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin.from("sgcc_case_parties").insert(casePartyRecords);

  // Crear evento de timeline
  await supabaseAdmin.from("sgcc_case_timeline").insert({
    id: randomUUID(),
    case_id: caseId,
    etapa: "solicitud",
    descripcion: `Solicitud radicada por ${(session.user as any).name ?? "staff"}`,
    completado: true,
    fecha: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  // Notificar al staff del centro
  const { data: admins } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, email")
    .eq("center_id", centerId)
    .in("rol", ["admin", "secretario"]);

  if (admins?.length) {
    await notify({
      centerId,
      caseId,
      tipo: "nueva_solicitud",
      titulo: `Nueva solicitud — ${numero_radicado}`,
      mensaje: `Se radicó una nueva solicitud de conciliación en materia ${materia}.\nRadicado: ${numero_radicado}`,
      recipients: admins.map((a) => ({ staffId: a.id, email: a.email })),
      canal: "both",
    });
  }

  return NextResponse.json({ caso }, { status: 201 });
}
