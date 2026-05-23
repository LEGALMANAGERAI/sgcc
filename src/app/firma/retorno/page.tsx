import Link from "next/link";
import { CheckCircle2, XCircle, FileSignature } from "lucide-react";

/**
 * Página de retorno tras firmar/rechazar en el portal de Legal Manager.
 * LM redirige aquí con ?estado=firmado|rechazado&solicitud_id=...&external_solicitud_id=...
 *
 * Es solo para UX: la fuente de verdad del estado es el webhook. Página pública.
 */
export default async function FirmaRetornoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const firmado = estado === "firmado";
  const rechazado = estado === "rechazado";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {firmado ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">¡Documento firmado!</h1>
            <p className="text-sm text-gray-600">
              Tu firma quedó registrada correctamente. Recibirás una copia del documento
              firmado por correo cuando todas las partes hayan firmado.
            </p>
          </>
        ) : rechazado ? (
          <>
            <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Firma rechazada</h1>
            <p className="text-sm text-gray-600">
              Registramos que decidiste no firmar el documento. Si fue un error, contacta
              al centro que te lo envió para que te reenvíe la solicitud.
            </p>
          </>
        ) : (
          <>
            <FileSignature className="w-14 h-14 text-[#0D2340] mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Proceso de firma</h1>
            <p className="text-sm text-gray-600">
              Gracias por usar el portal de firma. Puedes cerrar esta ventana.
            </p>
          </>
        )}

        <p className="mt-6 text-[11px] text-gray-400">
          Firma electrónica con tecnología de Legal Manager (Ley 527 de 1999).
        </p>

        <Link
          href="/login"
          className="inline-block mt-4 text-sm font-medium text-[#1B4F9B] hover:underline"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
