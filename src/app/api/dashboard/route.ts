import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}

function endOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // domingo
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── GET /api/dashboard ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const centerId = resolveCenterId(session);
    if (!centerId) {
      return NextResponse.json({ error: "Sin centro asignado" }, { status: 400 });
    }

    const user = session.user as any;
    const userId = user.id as string;
    const userRol = user.sgccRol as string;
    const esConciliador = userRol === "conciliador";

    const hoy = today();
    const inicioSemana = startOfWeek();
    const finSemana = endOfWeek();
    const en30Dias = addDays(new Date(), 30);

    // ── 1. Obtener todos los casos del centro (filtrado por rol) ─────────

    let casosQuery = supabaseAdmin
      .from("sgcc_cases")
      .select(`
        id, numero_radicado, tipo_tramite, materia, estado, cuantia,
        fecha_solicitud, conciliador_id, secretario_id,
        conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(id, nombre),
        secretario:sgcc_staff!sgcc_cases_secretario_id_fkey(id, nombre),
        partes:sgcc_case_parties(
          id, rol,
          party:sgcc_parties(id, nombres, apellidos, razon_social)
        )
      `)
      .eq("center_id", centerId)
      .order("created_at", { ascending: false });

    if (esConciliador) {
      casosQuery = casosQuery.eq("conciliador_id", userId);
    }

    const { data: casos, error: casosError } = await casosQuery;
    if (casosError) {
      return NextResponse.json({ error: casosError.message }, { status: 500 });
    }

    const allCasos = casos ?? [];
    const caseIds = allCasos.map((c) => c.id);

    // ── 2. Audiencias ────────────────────────────────────────────────────

    let audienciasHoyData: any[] = [];
    let countAudienciasHoy = 0;
    let countAudienciasSemana = 0;

    if (caseIds.length > 0) {
      // Audiencias de hoy
      const { data: audHoy } = await supabaseAdmin
        .from("sgcc_hearings")
        .select(`
          id, fecha_hora, sala_nombre, estado,
          case:sgcc_cases!sgcc_hearings_case_id_fkey(numero_radicado),
          case_id
        `)
        .in("case_id", caseIds)
        .gte("fecha_hora", `${hoy}T00:00:00`)
        .lt("fecha_hora", `${hoy}T23:59:59`)
        .order("fecha_hora", { ascending: true });

      audienciasHoyData = audHoy ?? [];
      countAudienciasHoy = audienciasHoyData.length;

      // Audiencias de la semana
      const { count: semanaCount } = await supabaseAdmin
        .from("sgcc_hearings")
        .select("*", { count: "exact", head: true })
        .in("case_id", caseIds)
        .gte("fecha_hora", `${inicioSemana}T00:00:00`)
        .lte("fecha_hora", `${finSemana}T23:59:59`);

      countAudienciasSemana = semanaCount ?? 0;
    }

    // ── 3. Próxima audiencia por caso ────────────────────────────────────

    let proximasAudiencias: Record<string, string> = {};

    if (caseIds.length > 0) {
      const { data: proxAud } = await supabaseAdmin
        .from("sgcc_hearings")
        .select("case_id, fecha_hora")
        .in("case_id", caseIds)
        .gte("fecha_hora", `${hoy}T00:00:00`)
        .order("fecha_hora", { ascending: true });

      if (proxAud) {
        for (const a of proxAud) {
          if (!proximasAudiencias[a.case_id]) {
            proximasAudiencias[a.case_id] = a.fecha_hora;
          }
        }
      }
    }

    // ── 4. Apoderados por caso (para alertas) ───────────────────────────

    let apoderadosPorParte: Record<string, any[]> = {};

    if (caseIds.length > 0) {
      const { data: caseAttorneys } = await supabaseAdmin
        .from("sgcc_case_attorneys")
        .select(`
          id, case_party_id, estado, cambio_reciente,
          attorney:sgcc_attorneys!sgcc_case_attorneys_attorney_id_fkey(
            id, nombre, tarjeta_profesional, tp_verificada, poder_vigente_hasta
          )
        `)
        .eq("activo", true);

      if (caseAttorneys) {
        for (const ca of caseAttorneys) {
          if (!apoderadosPorParte[ca.case_party_id]) {
            apoderadosPorParte[ca.case_party_id] = [];
          }
          apoderadosPorParte[ca.case_party_id].push(ca);
        }
      }
    }

    // ── 5. Alertas globales ─────────────────────────────────────────────

    const alertas: Array<{ tipo: string; mensaje: string; caso_id?: string; urgencia: string }> = [];

    // 5a. Apoderados sin TP verificada
    if (caseIds.length > 0) {
      const { data: sinVerificar } = await supabaseAdmin
        .from("sgcc_case_attorneys")
        .select(`
          id, case_party_id,
          attorney:sgcc_attorneys!sgcc_case_attorneys_attorney_id_fkey(nombre, tp_verificada),
          case_party:sgcc_case_parties!sgcc_case_attorneys_case_party_id_fkey(
            case_id,
            caso:sgcc_cases!sgcc_case_parties_case_id_fkey(numero_radicado)
          )
        `)
        .eq("activo", true);

      if (sinVerificar) {
        for (const item of sinVerificar) {
          const attorney = item.attorney as any;
          const caseParty = item.case_party as any;
          if (
            attorney &&
            !attorney.tp_verificada &&
            caseParty?.caso &&
            caseIds.includes(caseParty.case_id)
          ) {
            alertas.push({
              tipo: "apoderado_sin_verificar",
              mensaje: `Apoderado ${attorney.nombre} sin TP verificada — Caso ${caseParty.caso.numero_radicado}`,
              caso_id: caseParty.case_id,
              urgencia: "alta",
            });
          }
        }
      }
    }

    // 5b. Poderes próximos a vencer (< 30 días)
    if (caseIds.length > 0) {
      const { data: poderesVencer } = await supabaseAdmin
        .from("sgcc_case_attorneys")
        .select(`
          id,
          attorney:sgcc_attorneys!sgcc_case_attorneys_attorney_id_fkey(nombre, poder_vigente_hasta),
          case_party:sgcc_case_parties!sgcc_case_attorneys_case_party_id_fkey(
            case_id,
            caso:sgcc_cases!sgcc_case_parties_case_id_fkey(numero_radicado)
          )
        `)
        .eq("activo", true)
        .not("attorney.poder_vigente_hasta", "is", null);

      if (poderesVencer) {
        for (const item of poderesVencer) {
          const attorney = item.attorney as any;
          const caseParty = item.case_party as any;
          if (
            attorney?.poder_vigente_hasta &&
            attorney.poder_vigente_hasta <= en30Dias &&
            attorney.poder_vigente_hasta >= hoy &&
            caseParty?.caso &&
            caseIds.includes(caseParty.case_id)
          ) {
            alertas.push({
              tipo: "poder_por_vencer",
              mensaje: `Poder de ${attorney.nombre} vence el ${attorney.poder_vigente_hasta} — Caso ${caseParty.caso.numero_radicado}`,
              caso_id: caseParty.case_id,
              urgencia: "media",
            });
          }
        }
      }
    }

    // 5c. Correspondencia próxima a vencer
    if (caseIds.length > 0) {
      const { data: corresp } = await supabaseAdmin
        .from("sgcc_correspondence")
        .select("id, tipo, fecha_limite, case_id, asunto")
        .in("case_id", caseIds)
        .eq("estado", "pendiente")
        .not("fecha_limite", "is", null)
        .lte("fecha_limite", addDays(new Date(), 5));

      if (corresp) {
        for (const c of corresp) {
          const esTutela = c.tipo === "tutela";
          alertas.push({
            tipo: "correspondencia_vencer",
            mensaje: `${esTutela ? "Tutela" : "Correspondencia"}: "${c.asunto}" vence el ${c.fecha_limite}`,
            caso_id: c.case_id,
            urgencia: esTutela ? "critica" : "alta",
          });
        }
      }
    }

    // 5d. Checklists de admisión incompletas en casos activos
    if (caseIds.length > 0) {
      const casosActivos = allCasos
        .filter((c) => ["solicitud", "admitido", "en_tramite", "audiencia_programada"].includes(c.estado))
        .map((c) => c.id);

      if (casosActivos.length > 0) {
        const { data: checklists } = await supabaseAdmin
          .from("sgcc_checklists")
          .select("id, nombre, case_type")
          .eq("tipo", "admision");

        if (checklists?.length) {
          const checklistIds = checklists.map((cl) => cl.id);

          const { data: responses } = await supabaseAdmin
            .from("sgcc_checklist_responses")
            .select("id, checklist_id, case_id, completado")
            .in("case_id", casosActivos)
            .in("checklist_id", checklistIds);

          const respondidos = new Set(
            (responses ?? [])
              .filter((r) => r.completado)
              .map((r) => `${r.case_id}_${r.checklist_id}`)
          );

          for (const caso of allCasos.filter((c) => casosActivos.includes(c.id))) {
            for (const cl of checklists) {
              if (!respondidos.has(`${caso.id}_${cl.id}`)) {
                alertas.push({
                  tipo: "checklist_incompleta",
                  mensaje: `Checklist "${cl.nombre}" incompleta — Caso ${caso.numero_radicado}`,
                  caso_id: caso.id,
                  urgencia: "media",
                });
              }
            }
          }
        }
      }
    }

    // 5e. Procesos vigilados con actuaciones no leídas
    const { data: watchedProcesses } = await supabaseAdmin
      .from("sgcc_watched_processes")
      .select("id, radicado")
      .eq("center_id", centerId)
      .eq("activo", true);

    if (watchedProcesses?.length) {
      const watchIds = watchedProcesses.map((w) => w.id);

      const { data: updatesNoLeidos } = await supabaseAdmin
        .from("sgcc_process_updates")
        .select("id, watched_process_id, descripcion")
        .in("watched_process_id", watchIds)
        .eq("leido", false);

      if (updatesNoLeidos?.length) {
        const porProceso: Record<string, number> = {};
        for (const u of updatesNoLeidos) {
          porProceso[u.watched_process_id] = (porProceso[u.watched_process_id] ?? 0) + 1;
        }

        for (const wp of watchedProcesses) {
          const count = porProceso[wp.id];
          if (count) {
            alertas.push({
              tipo: "proceso_vigilado",
              mensaje: `Proceso ${wp.radicado}: ${count} actuación(es) sin leer`,
              urgencia: "media",
            });
          }
        }
      }
    }

    // ── 6. Stats ────────────────────────────────────────────────────────

    const totalCasos = allCasos.length;
    const casosActivosCount = allCasos.filter((c) =>
      ["solicitud", "admitido", "en_tramite", "audiencia_programada"].includes(c.estado)
    ).length;
    const enAudiencia = allCasos.filter((c) => c.estado === "audiencia_programada").length;
    const cerrados = allCasos.filter((c) =>
      ["cerrado", "archivado", "conciliado", "no_conciliado"].includes(c.estado)
    ).length;

    const porTipo: Record<string, number> = { conciliacion: 0, insolvencia: 0, acuerdo_apoyo: 0, arbitraje_ejecutivo: 0 };
    for (const c of allCasos) {
      const tipo = c.tipo_tramite as string;
      if (tipo && tipo in porTipo) {
        porTipo[tipo]++;
      }
    }

    const stats = {
      totalCasos,
      casosActivos: casosActivosCount,
      enAudiencia,
      cerrados,
      porTipo,
      audienciasHoy: countAudienciasHoy,
      audienciasSemana: countAudienciasSemana,
      alertasPendientes: alertas.length,
    };

    // ── 7. Construir misCasos con detalle ───────────────────────────────

    const misCasos = allCasos.map((caso) => {
      const partesDetalle = (caso.partes as any[] ?? []).map((cp: any) => {
        const party = cp.party;
        const nombre =
          party?.razon_social ||
          [party?.nombres, party?.apellidos].filter(Boolean).join(" ") ||
          "Sin nombre";

        // Buscar apoderado actual
        const apoderadoData = apoderadosPorParte[cp.id]?.[0];
        const apoderado = apoderadoData
          ? {
              nombre: apoderadoData.attorney?.nombre ?? null,
              verificado: apoderadoData.attorney?.tp_verificada ?? false,
              cambio_reciente: apoderadoData.cambio_reciente ?? false,
            }
          : null;

        return {
          id: cp.id,
          nombres: nombre,
          rol: cp.rol,
          apoderado_actual: apoderado,
        };
      });

      // Alertas específicas del caso
      const alertasCaso: string[] = [];
      for (const p of partesDetalle) {
        if (p.apoderado_actual?.cambio_reciente && !p.apoderado_actual?.verificado) {
          alertasCaso.push("Cambio de apoderado sin poder verificado");
        }
      }
      // Checklist incompleta
      const tieneChecklistPendiente = alertas.some(
        (a) => a.tipo === "checklist_incompleta" && a.caso_id === caso.id
      );
      if (tieneChecklistPendiente) {
        alertasCaso.push("Checklist de admisión incompleta");
      }

      const secretario = (caso.secretario as any)?.nombre
        ? { nombre: (caso.secretario as any).nombre }
        : null;

      return {
        id: caso.id,
        numero_radicado: caso.numero_radicado,
        tipo_tramite: caso.tipo_tramite,
        materia: caso.materia,
        estado: caso.estado,
        cuantia: caso.cuantia,
        fecha_solicitud: caso.fecha_solicitud,
        partes: partesDetalle,
        secretario,
        proximaAudiencia: proximasAudiencias[caso.id] ?? null,
        alertas: alertasCaso,
      };
    });

    // ── 8. Audiencias hoy con detalle ───────────────────────────────────

    const audienciasHoyResponse = audienciasHoyData.map((aud) => ({
      id: aud.id,
      fecha_hora: aud.fecha_hora,
      caso_radicado: (aud.case as any)?.numero_radicado ?? null,
      sala_nombre: aud.sala_nombre,
      estado: aud.estado,
    }));

    // ── 9. Equipo (secretarios supervisados) ────────────────────────────

    let equipo: any[] = [];

    if (esConciliador) {
      const { data: subordinados } = await supabaseAdmin
        .from("sgcc_staff")
        .select("id, nombre, email, rol, activo")
        .eq("center_id", centerId)
        .eq("supervisor_id", userId)
        .eq("activo", true);

      equipo = subordinados ?? [];
    }

    // ── Respuesta final ─────────────────────────────────────────────────

    return NextResponse.json({
      stats,
      misCasos,
      audienciasHoy: audienciasHoyResponse,
      alertas,
      equipo,
    });
  } catch (error: any) {
    console.error("[Dashboard API Error]", error);
    return NextResponse.json(
      { error: error.message ?? "Error interno del servidor" },
      { status: 500 }
    );
  }
}
