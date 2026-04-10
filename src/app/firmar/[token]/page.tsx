export const dynamic = "force-dynamic";

import { SigningClient } from "./SigningClient";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function FirmarPage({ params }: PageProps) {
  const { token } = await params;

  // Validar token del lado del servidor
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  let firmaData = null;
  let error = null;

  try {
    const res = await fetch(`${baseUrl}/api/firmar/${token}`, {
      cache: "no-store",
    });
    const data = await res.json();

    if (!res.ok) {
      error = data.error ?? "Enlace inv\u00e1lido o expirado";
    } else {
      firmaData = data;
    }
  } catch {
    error = "No se pudo validar el enlace. Intenta de nuevo m\u00e1s tarde.";
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">&#10060;</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Enlace no v&#225;lido</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return <SigningClient token={token} initialData={firmaData} />;
}
