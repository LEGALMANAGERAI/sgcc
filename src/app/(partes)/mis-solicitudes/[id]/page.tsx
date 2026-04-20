export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { WizardShell } from "./WizardShell";
import type { SolicitudDraft, AdjuntoDraft } from "@/types/solicitudes";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const userId = (session.user as { id: string }).id;

  const { data: draft } = await supabaseAdmin
    .from("sgcc_solicitudes_draft")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!draft) notFound();

  const { data: adjuntos } = await supabaseAdmin
    .from("sgcc_documents")
    .select("id, tipo_anexo, nombre_archivo, tamano_bytes, url, created_at, draft_id")
    .eq("draft_id", id);

  return (
    <WizardShell
      draft={draft as SolicitudDraft}
      initialAdjuntos={(adjuntos ?? []) as AdjuntoDraft[]}
    />
  );
}
