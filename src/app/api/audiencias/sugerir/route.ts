import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveCenterId } from "@/lib/server-utils";
import { sugerirHorariosAudiencia } from "@/lib/sugerencia-audiencias";
import type { SlotDisponible } from "@/lib/sugerencia-audiencias";

/**
 * GET /api/audiencias/sugerir
 *
 * Sugiere los mejores horarios disponibles para programar una audiencia.
 * Solo accesible por staff autenticado.
 *
 * Query params:
 * - center_id (required)
 * - conciliador_id (optional)
 * - sala_id (optional)
 * - duracion_min (default: 60)
 * - desde (ISO date, default: hoy)
 * - hasta (ISO date, default: hoy + 30 dias)
 * - max (default: 5)
 */
export async function GET(req: NextRequest) {
  // ── Auth check: solo staff ──
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.userType !== "staff") {
    return NextResponse.json(
      { error: "No autorizado. Solo personal del centro." },
      { status: 403 }
    );
  }

  // ── Parsear query params ──
  const params = req.nextUrl.searchParams;

  const centerId = params.get("center_id") ?? resolveCenterId(session);
  if (!centerId) {
    return NextResponse.json(
      { error: "Se requiere center_id" },
      { status: 400 }
    );
  }

  // Verificar que el staff pertenece al centro solicitado
  const staffCenterId = resolveCenterId(session);
  if (staffCenterId && staffCenterId !== centerId) {
    return NextResponse.json(
      { error: "No tiene acceso a este centro" },
      { status: 403 }
    );
  }

  const conciliadorId = params.get("conciliador_id") ?? undefined;
  const salaId = params.get("sala_id") ?? undefined;

  const duracionMinRaw = params.get("duracion_min");
  const duracionMin = duracionMinRaw ? parseInt(duracionMinRaw, 10) : 60;
  if (isNaN(duracionMin) || duracionMin < 15 || duracionMin > 480) {
    return NextResponse.json(
      { error: "duracion_min debe estar entre 15 y 480 minutos" },
      { status: 400 }
    );
  }

  const desdeRaw = params.get("desde");
  const diasDesde = desdeRaw ? new Date(desdeRaw) : undefined;
  if (desdeRaw && isNaN(diasDesde!.getTime())) {
    return NextResponse.json(
      { error: "Formato de fecha 'desde' invalido. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const hastaRaw = params.get("hasta");
  const diasHasta = hastaRaw ? new Date(hastaRaw) : undefined;
  if (hastaRaw && isNaN(diasHasta!.getTime())) {
    return NextResponse.json(
      { error: "Formato de fecha 'hasta' invalido. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const maxRaw = params.get("max");
  const maxResultados = maxRaw ? parseInt(maxRaw, 10) : 5;
  if (isNaN(maxResultados) || maxResultados < 1 || maxResultados > 20) {
    return NextResponse.json(
      { error: "max debe estar entre 1 y 20" },
      { status: 400 }
    );
  }

  // ── Ejecutar motor de sugerencia ──
  try {
    const sugerencias = await sugerirHorariosAudiencia({
      centerId,
      conciliadorId,
      salaId,
      duracionMin,
      diasDesde,
      diasHasta,
      maxResultados,
    });

    // Serializar fechas para JSON
    const sugerenciasJSON = sugerencias.map((s) => ({
      ...s,
      fecha: s.fecha.toISOString().split("T")[0],
    }));

    return NextResponse.json({ sugerencias: sugerenciasJSON });
  } catch (error) {
    console.error("[sugerir-audiencias] Error:", error);
    return NextResponse.json(
      { error: "Error al generar sugerencias de horario" },
      { status: 500 }
    );
  }
}
