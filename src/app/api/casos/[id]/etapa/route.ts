import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

type Etapa = "solicitud" | "admision" | "citacion" | "audiencia" | "acta" | "archivo";

/**
 * PATCH /api/casos/[id]/etapa
 * Body: { etapa: Etapa, data: {...} }
 * Edita los campos de una etapa del flujo del caso.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const body = await req.json();
  const etapa: Etapa = body.etapa;
  const data = body.data ?? {};
  const now = new Date().toISOString();

  switch (etapa) {
    case "solicitud": {
      const caseUpdate: Record<string, any> = { updated_at: now };
      for (const f of ["numero_radicado", "materia", "cuantia", "cuantia_indeterminada", "descripcion", "fecha_solicitud"]) {
        if (data[f] !== undefined) {
          let v = data[f];
          if (f === "cuantia") v = v === "" || v === null ? null : Number(v);
          else if (f === "cuantia_indeterminada") v = !!v;
          else if (typeof v === "string" && v.trim() === "" && f !== "descripcion" && f !== "numero_radicado") v = null;
          caseUpdate[f] = v;
        }
      }
      if (Object.keys(caseUpdate).length > 1) {
        const { error } = await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId).eq("center_id", centerId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (Array.isArray(data.partes)) {
        for (const p of data.partes) {
          if (!p.party_id) continue;
          const partyUpdate: Record<string, any> = { updated_at: now };
          for (const f of ["tipo_persona", "nombres", "apellidos", "tipo_doc", "numero_doc", "razon_social", "nit_empresa", "email", "telefono", "direccion", "ciudad"]) {
            if (p[f] !== undefined) {
              let v = p[f];
              // email es NOT NULL: no permitir vaciar
              if (f === "email" && (!v || String(v).trim() === "")) continue;
              if (typeof v === "string" && v.trim() === "") v = null;
              partyUpdate[f] = v;
            }
          }
          if (Object.keys(partyUpdate).length > 1) {
            const { error: pErr } = await supabaseAdmin.from("sgcc_parties").update(partyUpdate).eq("id", p.party_id);
            if (pErr) return NextResponse.json({ error: `Parte: ${pErr.message}` }, { status: 500 });
          }
          if (p.case_party_id) {
            const cpUpdate: Record<string, any> = {};
            if (p.apoderado_nombre !== undefined) cpUpdate.apoderado_nombre = p.apoderado_nombre || null;
            if (p.apoderado_doc !== undefined) cpUpdate.apoderado_doc = p.apoderado_doc || null;
            if (Object.keys(cpUpdate).length) {
              const { error: cpErr } = await supabaseAdmin.from("sgcc_case_parties").update(cpUpdate).eq("id", p.case_party_id);
              if (cpErr) return NextResponse.json({ error: `Apoderado: ${cpErr.message}` }, { status: 500 });
            }
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    case "admision": {
      const caseUpdate: Record<string, any> = { updated_at: now };
      for (const f of ["conciliador_id", "secretario_id", "motivo_rechazo", "fecha_admision"]) {
        if (data[f] !== undefined) caseUpdate[f] = data[f] || null;
      }
      const { error } = await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId).eq("center_id", centerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "citacion": {
      const caseUpdate: Record<string, any> = { updated_at: now };
      if (data.fecha_limite_citacion !== undefined) caseUpdate.fecha_limite_citacion = data.fecha_limite_citacion || null;
      if (Object.keys(caseUpdate).length > 1) {
        const { error } = await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId).eq("center_id", centerId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (Array.isArray(data.case_parties)) {
        for (const cp of data.case_parties) {
          if (!cp.id) continue;
          const cpUpdate: Record<string, any> = {};
          if (cp.citacion_enviada_at !== undefined) cpUpdate.citacion_enviada_at = cp.citacion_enviada_at || null;
          if (cp.citacion_confirmada_at !== undefined) cpUpdate.citacion_confirmada_at = cp.citacion_confirmada_at || null;
          if (Object.keys(cpUpdate).length) {
            await supabaseAdmin.from("sgcc_case_parties").update(cpUpdate).eq("id", cp.id);
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    case "audiencia": {
      if (!Array.isArray(data.audiencias)) return NextResponse.json({ error: "audiencias requerido" }, { status: 400 });
      for (const h of data.audiencias) {
        if (!h.id) continue;
        const upd: Record<string, any> = { updated_at: now };
        for (const f of ["fecha_hora", "duracion_min", "conciliador_id", "sala_id", "tipo", "notas_previas", "estado"]) {
          if (h[f] !== undefined) upd[f] = h[f] || null;
        }
        if (Object.keys(upd).length > 1) {
          await supabaseAdmin.from("sgcc_hearings").update(upd).eq("id", h.id).eq("case_id", caseId);
        }
      }
      return NextResponse.json({ ok: true });
    }

    case "acta": {
      if (!Array.isArray(data.actas)) return NextResponse.json({ error: "actas requerido" }, { status: 400 });
      for (const a of data.actas) {
        if (!a.id) continue;
        const upd: Record<string, any> = { updated_at: now };
        // Campos NOT NULL: solo actualizar si tienen valor
        for (const f of ["numero_acta", "tipo", "fecha_acta"]) {
          if (a[f] !== undefined && a[f] !== null && String(a[f]).trim() !== "") upd[f] = a[f];
        }
        // Campos nullable
        for (const f of ["consideraciones", "acuerdo_texto"]) {
          if (a[f] !== undefined) upd[f] = a[f] || null;
        }
        if (Object.keys(upd).length > 1) {
          const { error: aErr } = await supabaseAdmin.from("sgcc_actas").update(upd).eq("id", a.id).eq("case_id", caseId);
          if (aErr) return NextResponse.json({ error: `Acta: ${aErr.message}` }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    case "archivo": {
      const caseUpdate: Record<string, any> = { updated_at: now };
      for (const f of ["fecha_cierre", "sub_estado"]) {
        if (data[f] !== undefined) caseUpdate[f] = data[f] || null;
      }
      const { error } = await supabaseAdmin.from("sgcc_cases").update(caseUpdate).eq("id", caseId).eq("center_id", centerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }
}
