import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveCenterId } from "@/lib/server-utils";

/**
 * GET /api/admin/debug/mis-casos
 *
 * Endpoint TEMPORAL de diagnóstico. Devuelve JSON con:
 *  - datos de la sesión (user.id, email, userType, centerId, sgccRol)
 *  - staff_ids encontrados en este centro con ese email (case-insensitive)
 *  - casos donde aparece como conciliador_id o secretario_id directo
 *  - audiencias donde aparece como conciliador_id, con sus case_id
 *  - unión final (lo que debería ver en su listado)
 *
 * Útil cuando un conciliador dice "no veo mis casos" — responde qué está
 * pasando en los datos sin entrar a Supabase manualmente.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as any;
  const centerId = resolveCenterId(session);
  const email = user?.email as string | undefined;
  const sessionId = user?.id as string | undefined;

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
  if (sessionId) misIds.add(sessionId);
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

  return NextResponse.json({
    sesion: {
      user_id: sessionId,
      email,
      userType: user?.userType,
      centerId,
      sgccRol: user?.sgccRol,
      nombre: user?.name,
    },
    staff_rows_encontradas: staffRows ?? [],
    mis_staff_ids: misIdsArr,
    casos_directos: casosDirectos,
    audiencias_con_mi_conciliador: audiencias,
    total_casos_visibles: caseIds.size,
    case_ids_visibles: Array.from(caseIds),
  });
}
