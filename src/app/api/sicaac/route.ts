// src/app/api/sicaac/route.ts
// GET: lista unificada del control SICAAC del centro:
//   - expedientes (sgcc_cases) con su estado SICAAC
//   - registros manuales (sgcc_sicaac_manual) de cosas hechas por fuera
// POST: crea un registro manual.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");

  const [casosRes, manualRes] = await Promise.all([
    supabaseAdmin
      .from("sgcc_cases")
      .select(
        "id, numero_radicado, tipo_tramite, materia, fecha_solicitud, sicaac_estado, sicaac_numero_registro, sicaac_fecha_registro"
      )
      .eq("center_id", centerId)
      .is("archivado_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sgcc_sicaac_manual")
      .select("*")
      .eq("center_id", centerId)
      .order("created_at", { ascending: false }),
  ]);

  if (casosRes.error) return NextResponse.json({ error: casosRes.error.message }, { status: 500 });
  if (manualRes.error) return NextResponse.json({ error: manualRes.error.message }, { status: 500 });

  const expedientes = (casosRes.data ?? []).map((c) => ({
    id: c.id,
    origen: "expediente" as const,
    tipo: "expediente" as const,
    referencia: c.numero_radicado,
    tramite: c.tipo_tramite,
    fecha: c.fecha_solicitud,
    estado: c.sicaac_estado as "pendiente" | "registrado",
    numero_registro: c.sicaac_numero_registro,
    fecha_registro: c.sicaac_fecha_registro,
    case_id: c.id,
  }));

  const manuales = (manualRes.data ?? []).map((m: any) => ({
    id: m.id,
    origen: "manual" as const,
    tipo: m.tipo as "expediente" | "acta" | "constancia",
    referencia: m.referencia,
    tramite: null,
    fecha: m.fecha,
    estado: m.estado as "pendiente" | "registrado",
    numero_registro: m.sicaac_numero_registro,
    fecha_registro: m.sicaac_fecha_registro,
    observaciones: m.observaciones ?? null,
    case_id: null,
  }));

  let registros = [...expedientes, ...manuales];
  if (estado === "pendiente" || estado === "registrado") {
    registros = registros.filter((r) => r.estado === estado);
  }

  return NextResponse.json({ registros });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if ((session.user as any).userType !== "staff") {
    return NextResponse.json(
      { error: "Solo el personal del centro puede agregar registros" },
      { status: 403 }
    );
  }
  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });
  const staffId = (session.user as any).id as string | undefined;

  const body = await req.json().catch(() => ({}));
  const tipo = body?.tipo;
  const referencia = (body?.referencia as string | undefined)?.trim();
  const fecha = (body?.fecha as string | undefined)?.trim() || null;
  const estado = body?.estado === "registrado" ? "registrado" : "pendiente";
  const numero = (body?.numero_registro as string | undefined)?.trim() || null;
  const fechaReg = (body?.fecha_registro as string | undefined)?.trim() || null;
  const observaciones = (body?.observaciones as string | undefined)?.trim() || null;

  if (!["expediente", "acta", "constancia"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!referencia) {
    return NextResponse.json({ error: "La referencia (número o descripción) es requerida" }, { status: 400 });
  }
  if (estado === "registrado" && (!numero || !fechaReg)) {
    return NextResponse.json(
      { error: "Para marcar como registrado se requieren número y fecha de registro" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_sicaac_manual")
    .insert({
      center_id: centerId,
      tipo,
      referencia,
      fecha,
      estado,
      sicaac_numero_registro: estado === "registrado" ? numero : null,
      sicaac_fecha_registro: estado === "registrado" ? fechaReg : null,
      observaciones,
      creado_por_staff: staffId ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
