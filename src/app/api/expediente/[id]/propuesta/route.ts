import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";
import { randomUUID, randomBytes } from "crypto";
import { Resend } from "resend";

function getResend() { return new Resend(process.env.RESEND_API_KEY || "re_placeholder"); }
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/expediente/[id]/propuesta
 * Obtener propuesta(s) de pago del caso con votos.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;

  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .select("*, votos:sgcc_votacion_insolvencia(*, acreencia:sgcc_acreencias(acreedor_nombre))")
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/expediente/[id]/propuesta
 * Crear propuesta de pago.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();

  if (!body.titulo?.trim() || !body.descripcion?.trim()) {
    return NextResponse.json({ error: "Título y descripción son requeridos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .insert({
      id: randomUUID(),
      case_id: caseId,
      center_id: centerId,
      titulo: body.titulo.trim(),
      descripcion: body.descripcion.trim(),
      plazo_meses: body.plazo_meses ?? null,
      tasa_interes: body.tasa_interes?.trim() || null,
      periodo_gracia_meses: body.periodo_gracia_meses ?? 0,
      notas: body.notas?.trim() || null,
      estado: "borrador",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

/**
 * PATCH /api/expediente/[id]/propuesta
 * Actualizar propuesta o cambiar estado.
 * Body: { propuesta_id, ...campos }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const centerId = resolveCenterId(session);
  if (!centerId) return NextResponse.json({ error: "Sin centro" }, { status: 400 });

  const { id: caseId } = await params;
  const body = await req.json();
  const { propuesta_id, ...campos } = body;

  if (!propuesta_id) {
    return NextResponse.json({ error: "propuesta_id es requerido" }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  const allowed = ["titulo", "descripcion", "plazo_meses", "tasa_interes", "periodo_gracia_meses", "notas", "estado", "modo_votacion"];
  for (const key of allowed) {
    if (campos[key] !== undefined) updates[key] = campos[key];
  }

  // Timestamps según estado
  if (campos.estado === "socializada") updates.fecha_socializacion = new Date().toISOString();
  if (campos.estado === "en_votacion") updates.fecha_votacion = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("sgcc_propuesta_pago")
    .update(updates)
    .eq("id", propuesta_id)
    .eq("case_id", caseId)
    .eq("center_id", centerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si se abre votación en modo link o dual, generar tokens y enviar emails.
  // Un acreedor con varios créditos recibe UN SOLO email con UN token compartido que cubre
  // todas sus acreencias — la regla legal en insolvencia es 1 acreedor = 1 voto, con peso
  // = suma de % de sus créditos.
  const modo = campos.modo_votacion ?? data?.modo_votacion;
  if (campos.estado === "en_votacion" && (modo === "link" || modo === "dual")) {
    const { data: acreencias } = await supabaseAdmin
      .from("sgcc_acreencias")
      .select("id, acreedor_nombre, acreedor_documento, party_id, porcentaje_voto, con_capital")
      .eq("case_id", caseId)
      .eq("center_id", centerId);

    // Agrupar por acreedor (mismo criterio que la UI: documento normalizado | party_id | nombre)
    const claveAcreedor = (a: any): string => {
      const docNorm = (a?.acreedor_documento ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
      return docNorm || a?.party_id || (a?.acreedor_nombre ?? "").trim().toUpperCase() || `id-${a?.id}`;
    };

    type Grupo = {
      clave: string;
      acreencias: typeof acreencias;
      party_id: string | null;
      acreedor_nombre: string;
    };
    const grupos = new Map<string, Grupo>();
    for (const acr of acreencias ?? []) {
      const k = claveAcreedor(acr);
      if (!grupos.has(k)) {
        grupos.set(k, {
          clave: k,
          acreencias: [],
          party_id: acr.party_id ?? null,
          acreedor_nombre: acr.acreedor_nombre,
        });
      }
      const g = grupos.get(k)!;
      g.acreencias!.push(acr);
      if (!g.party_id && acr.party_id) g.party_id = acr.party_id;
    }

    for (const grupo of grupos.values()) {
      const token = `${randomUUID()}-${randomBytes(8).toString("hex")}`;
      const acrList = grupo.acreencias ?? [];

      // Persistir el MISMO token en todas las filas del grupo
      for (const acr of acrList) {
        const { data: existing } = await supabaseAdmin
          .from("sgcc_votacion_insolvencia")
          .select("id")
          .eq("propuesta_id", propuesta_id)
          .eq("acreencia_id", acr.id)
          .single();

        if (existing) {
          await supabaseAdmin
            .from("sgcc_votacion_insolvencia")
            .update({ token, porcentaje_voto: acr.porcentaje_voto })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin
            .from("sgcc_votacion_insolvencia")
            .insert({
              id: randomUUID(),
              propuesta_id,
              acreencia_id: acr.id,
              voto: null as any,
              porcentaje_voto: acr.porcentaje_voto,
              token,
              modo: "link",
              created_at: new Date().toISOString(),
            });
        }
      }

      // Enviar UN solo email al acreedor con el token compartido
      if (grupo.party_id) {
        const { data: party } = await supabaseAdmin
          .from("sgcc_parties")
          .select("email")
          .eq("id", grupo.party_id)
          .single();

        if (party?.email) {
          const linkVotar = `${APP_URL}/votar/${token}`;
          const pctTotal = acrList.reduce((s, a) => s + Number(a.porcentaje_voto || 0), 0);
          const capitalTotal = acrList.reduce((s, a) => s + Number(a.con_capital || 0), 0);
          const fmtMoney = (n: number) =>
            new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
          const detalleCreditos = acrList.length > 1
            ? `<p style="margin:12px 0 8px 0;font-size:13px;color:#6b7280;">Esta votación cubre los siguientes ${acrList.length} créditos a su nombre:</p>
               <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;">
                 ${acrList.map((a) => `<li>Capital conciliado ${fmtMoney(Number(a.con_capital || 0))}</li>`).join("")}
               </ul>`
            : "";
          try {
            await getResend().emails.send({
              from: "SGCC <notificaciones@sgcc.app>",
              to: party.email,
              subject: `Votación — Proceso de Insolvencia`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background:#0D2340;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
                    <h2 style="color:white;margin:0;">Votación — Insolvencia</h2>
                  </div>
                  <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
                    <p>Estimado/a <strong>${grupo.acreedor_nombre}</strong>,</p>
                    <p>Se le invita a votar sobre la siguiente propuesta de acuerdo de pagos:</p>
                    <div style="background:#f0f9ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #1B4F9B;">
                      <p style="margin:4px 0;"><strong>${data.titulo}</strong></p>
                      <p style="margin:8px 0 4px 0;font-size:13px;color:#374151;">
                        Capital conciliado total: <strong>${fmtMoney(capitalTotal)}</strong><br/>
                        Derecho de voto: <strong>${(pctTotal * 100).toFixed(2)}%</strong>
                      </p>
                      ${detalleCreditos}
                    </div>
                    <div style="text-align:center;margin:24px 0;">
                      <a href="${linkVotar}" style="display:inline-block;padding:12px 32px;background:#0D2340;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
                        Votar ahora
                      </a>
                    </div>
                    <p style="color:#6b7280;font-size:14px;">Este enlace es personal e intransferible. Se le pedirá verificar su identidad con un código OTP. Su voto se aplicará a la totalidad de sus créditos en este proceso.</p>
                  </div>
                </div>
              `,
            });
          } catch (err: any) {
            console.error(`Error enviando link votación a ${party.email}:`, err.message);
          }
        }
      }
    }
  }

  return NextResponse.json(data);
}
