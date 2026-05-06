import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, generateRadicado } from "@/lib/server-utils";
import { randomUUID } from "crypto";

const MATERIAS = new Set([
  "civil",
  "comercial",
  "laboral",
  "familiar",
  "consumidor",
  "arrendamiento",
  "otro",
]);

const TIPOS_TRAMITE = new Set(["conciliacion", "insolvencia", "acuerdo_apoyo"]);
const TIPOS_AUDIENCIA = new Set(["inicial", "continuacion", "complementaria"]);
const MODALIDADES = new Set(["presencial", "virtual", "mixta"]);

interface CreateBody {
  case_id?: string;
  caso_nuevo?: {
    tipo_tramite?: string;
    materia: string;
    descripcion: string;
  };
  fecha_hora: string;
  duracion_min?: number;
  tipo?: string;
  modalidad?: string;
  plataforma_virtual?: string | null;
  sala_id?: string | null;
  conciliador_id?: string | null;
  notas_previas?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });

  const userId = (session.user as any).id as string;
  const body = (await req.json()) as CreateBody;

  if (!body.fecha_hora) {
    return NextResponse.json({ error: "Fecha y hora son requeridas" }, { status: 400 });
  }

  const tipo = body.tipo ?? "inicial";
  if (!TIPOS_AUDIENCIA.has(tipo)) {
    return NextResponse.json({ error: "Tipo de audiencia inválido" }, { status: 400 });
  }

  const modalidad = body.modalidad ?? "presencial";
  if (!MODALIDADES.has(modalidad)) {
    return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 });
  }

  const duracion = Number.isFinite(body.duracion_min)
    ? Math.max(15, Math.min(600, body.duracion_min as number))
    : 60;

  // ─── 1) Resolver case_id (existente o crear rápido) ───────────────────────
  let caseId = body.case_id ?? null;

  if (!caseId && !body.caso_nuevo) {
    return NextResponse.json(
      { error: "Debe enviar case_id o caso_nuevo" },
      { status: 400 }
    );
  }

  if (caseId) {
    // Validar que el caso pertenezca al centro
    const { data: caso } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, center_id")
      .eq("id", caseId)
      .maybeSingle();
    if (!caso || caso.center_id !== centerId) {
      return NextResponse.json({ error: "Expediente no pertenece al centro" }, { status: 400 });
    }
  } else if (body.caso_nuevo) {
    const { materia, descripcion } = body.caso_nuevo;
    const tipoTramite = body.caso_nuevo.tipo_tramite ?? "conciliacion";

    if (!MATERIAS.has(String(materia))) {
      return NextResponse.json({ error: "Materia inválida" }, { status: 400 });
    }
    if (!TIPOS_TRAMITE.has(tipoTramite)) {
      return NextResponse.json({ error: "Tipo de trámite inválido" }, { status: 400 });
    }
    if (!descripcion || !String(descripcion).trim()) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    // Crear caso con retry-on-conflict (mismo patrón que /api/casos)
    const newCaseId = randomUUID();
    let inserted = false;
    let lastErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const numeroRadicado = await generateRadicado(centerId);
      const { error } = await supabaseAdmin.from("sgcc_cases").insert({
        id: newCaseId,
        center_id: centerId,
        numero_radicado: numeroRadicado,
        tipo_tramite: tipoTramite,
        materia,
        descripcion: String(descripcion).trim(),
        estado: "solicitud",
        fecha_solicitud: new Date().toISOString(),
        created_by_staff: userId,
      });
      if (!error) {
        inserted = true;
        break;
      }
      lastErr = error;
      if (error.code !== "23505") break; // 23505 = unique_violation
    }

    if (!inserted) {
      return NextResponse.json(
        { error: lastErr?.message ?? "No se pudo crear el expediente" },
        { status: 500 }
      );
    }
    caseId = newCaseId;
  }

  // ─── 2) Validar disponibilidad del conciliador ────────────────────────────
  const concId = body.conciliador_id ?? null;
  if (concId) {
    const start = new Date(body.fecha_hora);
    const end = new Date(start.getTime() + duracion * 60 * 1000);
    const { data: conflictos } = await supabaseAdmin
      .from("sgcc_hearings")
      .select("id")
      .eq("conciliador_id", concId)
      .neq("estado", "cancelada")
      .gte("fecha_hora", start.toISOString())
      .lt("fecha_hora", end.toISOString());

    if (conflictos && conflictos.length > 0) {
      return NextResponse.json(
        { error: "El conciliador ya tiene una audiencia en ese horario" },
        { status: 409 }
      );
    }
  }

  // ─── 3) Insertar audiencia ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const hearingId = randomUUID();

  const { error } = await supabaseAdmin.from("sgcc_hearings").insert({
    id: hearingId,
    case_id: caseId!,
    conciliador_id: concId,
    sala_id: body.sala_id ?? null,
    fecha_hora: body.fecha_hora,
    duracion_min: duracion,
    estado: "programada",
    tipo,
    modalidad,
    plataforma_virtual: modalidad === "presencial" ? null : body.plataforma_virtual ?? null,
    notas_previas: body.notas_previas ?? null,
    created_at: now,
    updated_at: now,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sincronizar caso: fecha_audiencia (solo si inicial) y conciliador si estaba vacío
  const { data: caseFresh } = await supabaseAdmin
    .from("sgcc_cases")
    .select("estado, conciliador_id")
    .eq("id", caseId!)
    .single();

  const caseUpdate: Record<string, unknown> = { updated_at: now };
  if (tipo === "inicial") caseUpdate.fecha_audiencia = body.fecha_hora;
  if (concId && caseFresh && !caseFresh.conciliador_id) caseUpdate.conciliador_id = concId;
  if (caseFresh?.estado === "citado") caseUpdate.estado = "audiencia";
  if (Object.keys(caseUpdate).length > 1) {
    await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId!);
  }

  return NextResponse.json({ id: hearingId, case_id: caseId }, { status: 201 });
}
