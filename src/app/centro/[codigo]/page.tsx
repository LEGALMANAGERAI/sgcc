export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, LogIn, MapPin } from "lucide-react";
import { SgccLogo } from "@/components/ui/SgccLogo";

interface Props {
  params: Promise<{ codigo: string }>;
}

export default async function CentroLandingPage({ params }: Props) {
  const { codigo } = await params;
  const codigoLimpio = codigo.trim();

  const { data: centro } = await supabaseAdmin
    .from("sgcc_centers")
    .select("id, codigo_corto, nombre, ciudad, departamento, logo_url, color_primario, color_secundario, activo")
    .ilike("codigo_corto", codigoLimpio)
    .maybeSingle();

  if (!centro || !centro.activo) notFound();

  const colorPrimario = centro.color_primario || "#0D2340";
  const colorSecundario = centro.color_secundario || "#1B4F9B";

  const ciudadLinea = [centro.ciudad, centro.departamento].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header con la marca del centro */}
          <div
            className="px-8 py-10 flex flex-col items-center text-center"
            style={{ background: `linear-gradient(135deg, ${colorPrimario} 0%, ${colorSecundario} 100%)` }}
          >
            {centro.logo_url ? (
              <div className="bg-white rounded-xl p-3 mb-4 shadow-md">
                <Image
                  src={centro.logo_url}
                  alt={`Logo ${centro.nombre}`}
                  width={120}
                  height={120}
                  className="object-contain w-24 h-24"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-20 h-20 bg-white/15 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                <FileText className="w-10 h-10 text-white/90" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white leading-tight">{centro.nombre}</h1>
            {ciudadLinea && (
              <p className="text-white/80 text-sm mt-1 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {ciudadLinea}
              </p>
            )}
          </div>

          {/* Contenido */}
          <div className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-base font-semibold text-gray-900">Trámites en línea</h2>
              <p className="text-sm text-gray-500 mt-1">
                Crea tu cuenta para iniciar una solicitud o consultar el estado de tu caso.
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href={`/registro/parte?codigo=${centro.codigo_corto}`}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl text-white font-medium transition-transform hover:scale-[1.01]"
                style={{ background: colorPrimario }}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  Iniciar nueva solicitud
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={`/registro/parte?codigo=${centro.codigo_corto}`}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl border-2 font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: colorSecundario, color: colorPrimario }}
              >
                <span className="flex items-center gap-2.5">
                  <LogIn className="w-4 h-4" />
                  Acceder a mi caso
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <p className="text-center text-xs text-gray-500 pt-3 border-t border-gray-100">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-medium underline" style={{ color: colorSecundario }}>
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer SGCC */}
      <footer className="py-6 flex justify-center">
        <a
          href="https://sgcc-rouge.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-2 transition-colors"
        >
          Plataforma operada por
          <SgccLogo size="sm" symbolOnly />
        </a>
      </footer>
    </div>
  );
}
