import { supabaseAdmin } from "./supabase";

type MetodoAsignacion = "manual" | "aleatorio" | "orden_lista";

interface ConciliadorDisponible {
  id: string;
  nombre: string;
  orden_lista: number | null;
  ultima_asignacion: string | null;
}

/**
 * Asigna un conciliador según el método configurado del centro.
 * Retorna el ID del conciliador asignado o null si es manual.
 *
 * - manual: no asigna automáticamente (retorna null)
 * - aleatorio: sorteo aleatorio entre conciliadores activos
 * - orden_lista: round-robin, nunca repite hasta que todos hayan tenido oportunidad
 */
export async function asignarConciliador(
  centerId: string,
  conciliadorSolicitado?: string | null
): Promise<string | null> {
  // Si el usuario solicitó un conciliador específico, respetar eso
  if (conciliadorSolicitado) return conciliadorSolicitado;

  // Obtener método del centro
  const { data: center } = await supabaseAdmin
    .from("sgcc_centers")
    .select("metodo_asignacion")
    .eq("id", centerId)
    .single();

  const metodo: MetodoAsignacion = center?.metodo_asignacion ?? "manual";

  if (metodo === "manual") return null;

  // Obtener conciliadores activos del centro
  const { data: conciliadores } = await supabaseAdmin
    .from("sgcc_staff")
    .select("id, nombre, orden_lista, ultima_asignacion")
    .eq("center_id", centerId)
    .eq("rol", "conciliador")
    .eq("activo", true)
    .order("orden_lista", { ascending: true, nullsFirst: false });

  const disponibles: ConciliadorDisponible[] = conciliadores ?? [];

  if (disponibles.length === 0) return null;
  if (disponibles.length === 1) return marcarAsignacion(disponibles[0].id);

  if (metodo === "aleatorio") {
    const idx = Math.floor(Math.random() * disponibles.length);
    return marcarAsignacion(disponibles[idx].id);
  }

  if (metodo === "orden_lista") {
    // Round-robin: el que tenga la ultima_asignacion más antigua (o nunca asignado) va primero
    const ordenados = [...disponibles].sort((a, b) => {
      // Nunca asignados van primero
      if (!a.ultima_asignacion && b.ultima_asignacion) return -1;
      if (a.ultima_asignacion && !b.ultima_asignacion) return 1;
      if (!a.ultima_asignacion && !b.ultima_asignacion) {
        // Ambos sin asignación: usar orden_lista
        return (a.orden_lista ?? 999) - (b.orden_lista ?? 999);
      }
      // Ambos asignados: el más antiguo va primero
      return new Date(a.ultima_asignacion!).getTime() - new Date(b.ultima_asignacion!).getTime();
    });

    return marcarAsignacion(ordenados[0].id);
  }

  return null;
}

async function marcarAsignacion(staffId: string): Promise<string> {
  await supabaseAdmin
    .from("sgcc_staff")
    .update({ ultima_asignacion: new Date().toISOString() })
    .eq("id", staffId);

  return staffId;
}
