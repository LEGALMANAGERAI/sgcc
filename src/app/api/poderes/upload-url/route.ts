import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import {
  PODERES_ALLOWED_MIME,
  PODERES_MAX_BYTES,
  createSignedUploadUrl,
} from "@/lib/poderes-storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { mimeType, sizeBytes } = body ?? {};

  if (typeof mimeType !== "string" || !PODERES_ALLOWED_MIME.includes(mimeType)) {
    return NextResponse.json(
      { error: `Solo se permiten archivos PDF (recibido: ${mimeType ?? "sin tipo"})` },
      { status: 400 },
    );
  }

  if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes requerido" }, { status: 400 });
  }

  if (sizeBytes > PODERES_MAX_BYTES) {
    const mb = (sizeBytes / 1024 / 1024).toFixed(1);
    const maxMb = (PODERES_MAX_BYTES / 1024 / 1024).toFixed(0);
    return NextResponse.json(
      { error: `El archivo pesa ${mb} MB y excede el maximo permitido (${maxMb} MB).` },
      { status: 400 },
    );
  }

  const path = `tmp/${randomUUID()}.pdf`;

  try {
    const { signedUrl, token } = await createSignedUploadUrl(path);
    return NextResponse.json({ signedUrl, token, path });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "No se pudo generar la URL de subida" },
      { status: 500 },
    );
  }
}
