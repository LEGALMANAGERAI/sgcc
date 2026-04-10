export const dynamic = "force-dynamic";

import { VotarClient } from "./VotarClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function VotarPage({ params }: Props) {
  const { token } = await params;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  let data = null;
  let error = null;

  try {
    const res = await fetch(`${baseUrl}/api/votar/${token}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      error = json.error ?? "Enlace inválido";
      if (json.voto) error = `Ya registró su voto: ${json.voto === "positivo" ? "A FAVOR" : json.voto === "negativo" ? "EN CONTRA" : "ABSTENCIÓN"}`;
    } else {
      data = json;
    }
  } catch {
    error = "No se pudo cargar la información. Intente de nuevo.";
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">&#9888;</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Votación</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return <VotarClient token={token} initialData={data} />;
}
