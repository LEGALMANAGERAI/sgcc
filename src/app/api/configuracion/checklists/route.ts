import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/* ─── GET: Listar checklists del centro ─────────────────────────────────── */

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_checklists")
    .select("*")
    .eq("center_id", user.centerId)
    .eq("activo", true)
    .order("tipo_tramite")
    .order("tipo_checklist");

  if (error) {
    return NextResponse.json({ error: "Error al obtener checklists: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ checklists: data });
}

/* ─── POST: Crear nueva checklist ───────────────────────────────────────── */

const TIPOS_TRAMITE_VALIDOS = ["conciliacion", "insolvencia", "acuerdo_apoyo"];
const TIPOS_CHECKLIST_VALIDOS = ["admision", "poderes"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.sgccRol !== "admin") {
    return NextResponse.json({ error: "No autorizado. Solo administradores." }, { status: 403 });
  }

  const body = await request.json();
  const { tipo_tramite, tipo_checklist, nombre, items } = body;

  // Validaciones
  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre de la checklist es requerido" }, { status: 400 });
  }

  if (!TIPOS_TRAMITE_VALIDOS.includes(tipo_tramite)) {
    return NextResponse.json(
      { error: `Tipo de trámite inválido. Valores permitidos: ${TIPOS_TRAMITE_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!TIPOS_CHECKLIST_VALIDOS.includes(tipo_checklist)) {
    return NextResponse.json(
      { error: `Tipo de checklist inválido. Valores permitidos: ${TIPOS_CHECKLIST_VALIDOS.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sgcc_checklists")
    .insert({
      center_id: user.centerId,
      tipo_tramite,
      tipo_checklist,
      nombre: nombre.trim(),
      items: Array.isArray(items) ? items : [],
      activo: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear checklist: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ checklist: data }, { status: 201 });
}
