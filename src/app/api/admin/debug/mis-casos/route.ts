import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/admin/debug/mis-casos[?email=otro@correo.com]
 *
 * Endpoint TEMPORAL de diagnóstico. Si se pasa ?email=... y el solicitante
 * es admin/secretario del centro, devuelve la info de ESE usuario. Si no,
 * devuelve la del propio solicitante.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  const centerId = resolveCenterId(session);
  const sessionEmail = user?.email as string | undefined;
  const sessionId = user?.id as string | undefined;
  const sessionRol = user?.sgccRol as string | undefined;

  // Admin/secretario puede consultar a otro staff via ?email=
  const queryEmail = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const puedeConsultarOtros = sessionRol === "admin" || sessionRol === "secretario";
  const email = queryEmail && puedeConsultarOtros ? queryEmail : sessionEmail;

  if (!centerId) {
    return NextResponse.json({ sesion: user, error: "Sin center_id en la sesión" }, { status: 400 });
  }

  // Buscar todos los staff del centro con ese email (case-insensitive)
  const { data: staffRows } = email
    ? await supabaseAdmin
        .from("sgcc_staff")
        .select("id, email, nombre, rol, activo")
        .ilike("email", email)
        .eq("center_id", centerId)
    : { data: [] };

  const misIds = new Set<string>();
  // Solo agregamos el sessionId si estamos consultando al propio usuario
  if (!queryEmail && sessionId) misIds.add(sessionId);
  for (const s of staffRows ?? []) if (s.activo) misIds.add(s.id);
  const misIdsArr = Array.from(misIds);

  // Casos directos
  let casosDirectos: any[] = [];
  if (misIdsArr.length > 0) {
    const orFilter = misIdsArr
      .flatMap((id) => [`conciliador_id.eq.${id}`, `secretario_id.eq.${id}`])
      .join(",");
    const { data } = await supabaseAdmin
      .from("sgcc_cases")
      .select("id, numero_radicado, conciliador_id, secretario_id")
      .eq("center_id", centerId)
      .or(orFilter);
    casosDirectos = data ?? [];
  }

  // Audiencias donde es conciliador
  let audiencias: any[] = [];
  if (misIdsArr.length > 0) {
    const { data } = await supabaseAdmin
      .from("sgcc_hearings")
      .select(
        "id, case_id, conciliador_id, fecha_hora, estado, caso:sgcc_cases!inner(numero_radicado, center_id)",
      )
      .in("conciliador_id", misIdsArr)
      .eq("caso.center_id", centerId);
    audiencias = data ?? [];
  }

  // Unión
  const caseIds = new Set<string>();
  for (const c of casosDirectos) caseIds.add(c.id);
  for (const h of audiencias) if (h.case_id) caseIds.add(h.case_id);

  // Si admin consultó por ?email=, también traemos un dump de TODOS los
  // casos del centro con sus conciliador_id/secretario_id actuales, para
  // verificar visualmente si la asignación quedó guardada.
  let dumpCasosCentro: any[] | null = null;
  let dumpStaffCentro: any[] | null = null;
  if (queryEmail && puedeConsultarOtros) {
    const { data } = await supabaseAdmin
      .from("sgcc_cases")
      .select(
        "id, numero_radicado, conciliador_id, secretario_id, conciliador:sgcc_staff!sgcc_cases_conciliador_id_fkey(nombre)",
      )
      .eq("center_id", centerId)
      .order("created_at", { ascending: false })
      .limit(50);
    dumpCasosCentro = data ?? [];

    // Dump de TODOS los staff del centro para detectar duplicados
    const { data: allStaff } = await supabaseAdmin
      .from("sgcc_staff")
      .select("id, email, nombre, rol, activo, created_at")
      .eq("center_id", centerId)
      .order("nombre", { ascending: true });
    dumpStaffCentro = allStaff ?? [];
  }

  return NextResponse.json({
    consultando: queryEmail && puedeConsultarOtros ? `otro usuario (${queryEmail})` : "tu propia sesión",
    sesion: {
      user_id: sessionId,
      email: sessionEmail,
      userType: user?.userType,
      centerId,
      sgccRol: user?.sgccRol,
      nombre: user?.name,
    },
    email_consultado: email,
    staff_rows_encontradas: staffRows ?? [],
    mis_staff_ids: misIdsArr,
    casos_directos: casosDirectos,
    audiencias_con_mi_conciliador: audiencias,
    total_casos_visibles: caseIds.size,
    case_ids_visibles: Array.from(caseIds),
    ...(dumpCasosCentro ? { dump_casos_centro: dumpCasosCentro } : {}),
    ...(dumpStaffCentro ? { dump_staff_centro: dumpStaffCentro } : {}),
  });
}
