import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId, generateRadicado, addBusinessDays } from "@/lib/server-utils";
import { notify } from "@/lib/notifications";
import { randomUUID } from "crypto";
import { asignarConciliador } from "@/lib/asignacion-conciliador";
import { findOrCreateParty } from "@/lib/parties";
import {
  isTempPoderPath,
  movePoderToFinal,
  verifyPoderIsPdf,
  deletePoder,
} from "@/lib/poderes-storage";

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
    .is("archivado_at", null)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (materia) query = query.eq("materia", materia);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  // Solo JSON. Los poderes se suben aparte via signed URL al bucket privado
  // y aqui llegan como `tmp_poder_path` dentro de cada parte.
  const body = await req.json();

  const {
    tipo_tramite,
    materia,
    descripcion,
    cuantia,
    cuantia_indeterminada,
    conciliador_id,
    sala_id,
    partes,
  } = body;

  // En insolvencia no se captura "hechos y pretensiones", así que la
  // descripción no es obligatoria para ese trámite.
  const descripcionRequerida = tipo_tramite !== "insolvencia";
  if (!materia || (descripcionRequerida && !descripcion) || !partes?.length) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  // Soportamos múltiples convocantes (varios demandantes en un mismo trámite).
  const convocantes = partes.filter((p: any) => p.rol === "convocante");
  if (!convocantes.length) {
    return NextResponse.json({ error: "Se requiere al menos un convocante" }, { status: 400 });
  }

  const convocados = partes.filter((p: any) => p.rol === "convocado");
  if (!convocados.length) {
    return NextResponse.json({ error: "Se requiere al menos un convocado" }, { status: 400 });
  }

  const caseId = randomUUID();

  // Asignar conciliador según método del centro
  const conciliadorAsignado = await asignarConciliador(centerId, conciliador_id);

  // Insertar caso con retry-on-conflict del numero_radicado.
  // Aunque generateRadicado ya usa MAX (no COUNT), pueden ocurrir colisiones
  // si dos requests entran en paralelo: el retry busca el siguiente disponible.
  let caso: any = null;
  let caseError: any = null;
  let numero_radicado = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    numero_radicado = await generateRadicado(centerId);
    const result = await supabaseAdmin
      .from("sgcc_cases")
      .insert({
        id: caseId,
        center_id: centerId,
        numero_radicado,
        tipo_tramite: tipo_tramite || "conciliacion",
        materia,
        descripcion: descripcion ?? "",
        cuantia: cuantia ?? null,
        cuantia_indeterminada: cuantia_indeterminada ?? false,
        conciliador_id: conciliadorAsignado,
        sala_id: sala_id ?? null,
        estado: "solicitud",
        fecha_solicitud: new Date().toISOString().split("T")[0],
        created_by_staff: (session.user as any).id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (!result.error) {
      caso = result.data;
      caseError = null;
      break;
    }
    caseError = result.error;
    // 23505 = unique_violation en Postgres
    if (result.error.code !== "23505") break;
  }

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });

  // Crear o encontrar partes (match por documento, NUNCA por email) y vincular al caso
  const casePartyRecords: any[] = [];

  for (const p of partes) {
    const { partyId } = await findOrCreateParty(
      {
        tipo_persona: p.tipo_persona,
        nombres: p.nombres,
        apellidos: p.apellidos,
        razon_social: p.razon_social,
        tipo_doc: p.tipo_doc,
        numero_doc: p.numero_doc,
        email: p.email,
        telefono: p.telefono,
      },
      { comoInvitado: true },
    );

    casePartyRecords.push({
      id: randomUUID(),
      case_id: caseId,
      party_id: partyId,
      rol: p.rol,
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin.from("sgcc_case_parties").insert(casePartyRecords);

  // Para insolvencia: crear una acreencia inicial por cada convocado (acreedor)
  if (tipo_tramite === "insolvencia") {
    const now = new Date().toISOString();
    const acreenciaRows = partes
      .map((p: any, idx: number) => ({ p, cp: casePartyRecords[idx] }))
      .filter(({ p }: any) => p.rol === "convocado")
      .map(({ p, cp }: any) => ({
        id: randomUUID(),
        case_id: caseId,
        center_id: centerId,
        party_id: cp?.party_id ?? null,
        acreedor_tipo: p.tipo_persona === "juridica" ? "juridica" : "natural",
        acreedor_nombre:
          p.tipo_persona === "juridica"
            ? p.razon_social || ""
            : [p.nombres, p.apellidos].filter(Boolean).join(" ") || "",
        acreedor_documento: p.numero_doc || null,
        created_at: now,
        updated_at: now,
      }));
    if (acreenciaRows.length > 0) {
      await supabaseAdmin.from("sgcc_acreencias").insert(acreenciaRows);
    }
  }

  // Crear apoderados si se proporcionaron.
  // Recolectamos warnings en lugar de abortar el caso, así el expediente queda
  // creado y el frontend recibe la lista de apoderados que NO se pudieron
  // guardar para poder reintentar manualmente.
  const apoderadosWarnings: Array<{ idx: number; nombre: string; error: string }> = [];

  // Normalizador de documento para no crear duplicados de attorneys por
  // diferencias de puntos/guiones/espacios.
  const normDoc = (d: string) => (d ?? "").replace(/[\s.\-_]/g, "").toUpperCase();

  for (let idx = 0; idx < partes.length; idx++) {
    const p = partes[idx];
    if (!p.apoderado || !p.apoderado.nombre || !p.apoderado.numero_doc) continue;

    const partyRecord = casePartyRecords[idx];
    if (!partyRecord) {
      apoderadosWarnings.push({ idx, nombre: p.apoderado.nombre, error: "No se encontró la parte vinculada" });
      continue;
    }

    const att = p.apoderado;
    const now = new Date().toISOString();
    const docNormalizado = normDoc(att.numero_doc);

    // Buscar attorney existente: primero exacto, luego por documento normalizado.
    let attorneyId: string | null = null;
    const { data: existingExact } = await supabaseAdmin
      .from("sgcc_attorneys")
      .select("id, numero_doc")
      .eq("numero_doc", att.numero_doc)
      .maybeSingle();

    let existingAtt = existingExact;
    if (!existingAtt && docNormalizado) {
      // Si no encontró exacto, busca por todos los attorneys con doc normalizado igual.
      // Solo válido cuando es claramente una variación de formato (raro).
      const { data: candidatos } = await supabaseAdmin
        .from("sgcc_attorneys")
        .select("id, numero_doc");
      const match = (candidatos ?? []).find((c) => normDoc(c.numero_doc) === docNormalizado);
      if (match) existingAtt = match;
    }

    if (existingAtt) {
      attorneyId = existingAtt.id;
      const { error: updErr } = await supabaseAdmin.from("sgcc_attorneys").update({
        nombre: att.nombre,
        tipo_doc: att.tipo_doc ?? "CC",
        tarjeta_profesional: att.tarjeta_profesional || null,
        email: att.email || null,
        telefono: att.telefono || null,
        updated_at: now,
      }).eq("id", attorneyId);
      if (updErr) {
        console.error(`[CASOS] update attorney falló: ${updErr.message}`);
      }
    } else {
      const newId = randomUUID();
      const { error: insAttErr } = await supabaseAdmin.from("sgcc_attorneys").insert({
        id: newId,
        nombre: att.nombre,
        tipo_doc: att.tipo_doc ?? "CC",
        numero_doc: att.numero_doc,
        tarjeta_profesional: att.tarjeta_profesional || null,
        email: att.email || null,
        telefono: att.telefono || null,
        created_at: now,
        updated_at: now,
      });
      if (insAttErr) {
        console.error(`[CASOS] insert attorney falló: ${insAttErr.message}`);
        apoderadosWarnings.push({ idx, nombre: att.nombre, error: `No se pudo crear el apoderado: ${insAttErr.message}` });
        continue;
      }
      attorneyId = newId;
    }

    if (!attorneyId) continue;

    // Crear case_attorney
    const caseAttorneyId = randomUUID();
    let poderPathFinal: string | null = null;

    // Mover poder desde tmp/ al path final, si el frontend ya lo subio
    const tmpPoderPath = p.tmp_poder_path as string | undefined;
    if (tmpPoderPath && isTempPoderPath(tmpPoderPath)) {
      const isPdf = await verifyPoderIsPdf(tmpPoderPath);
      if (!isPdf) {
        await deletePoder(tmpPoderPath);
        apoderadosWarnings.push({
          idx,
          nombre: att.nombre,
          error: "El archivo del poder no es un PDF valido (firma magica incorrecta).",
        });
      } else {
        const moveResult = await movePoderToFinal(tmpPoderPath, caseId, caseAttorneyId);
        if ("error" in moveResult) {
          await deletePoder(tmpPoderPath);
          apoderadosWarnings.push({ idx, nombre: att.nombre, error: moveResult.error });
        } else {
          poderPathFinal = moveResult.path;
        }
      }
    }

    const { error: insCaErr } = await supabaseAdmin.from("sgcc_case_attorneys").insert({
      id: caseAttorneyId,
      case_id: caseId,
      party_id: partyRecord.party_id,
      attorney_id: attorneyId,
      motivo_cambio: "inicial",
      poder_url: poderPathFinal,
      registrado_por: (session.user as any).id,
      activo: true,
      created_at: now,
      updated_at: now,
    });

    if (insCaErr) {
      console.error(`[CASOS] insert case_attorney falló: ${insCaErr.message}`);
      apoderadosWarnings.push({ idx, nombre: att.nombre, error: `No se pudo vincular el apoderado al caso: ${insCaErr.message}` });
      if (poderPathFinal) {
        await deletePoder(poderPathFinal);
      }
    }
  }

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

  return NextResponse.json(
    { caso, apoderadosWarnings: apoderadosWarnings.length > 0 ? apoderadosWarnings : undefined },
    { status: 201 },
  );
}
