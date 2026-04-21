"use client";

import { FileText, Hash, Calendar, Scale, Coins, Users } from "lucide-react";
import { partyDisplayName } from "@/types";
import { ClientDate } from "@/components/ui/ClientDate";

interface DatosHeredadosBannerProps {
  caso: any;
  partes: any[];
}

function fmtDinero(v: number | null | undefined, indet: boolean) {
  if (indet) return "Indeterminada";
  if (v == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
}

const MATERIA_LABEL: Record<string, string> = {
  civil: "Civil",
  comercial: "Comercial",
  laboral: "Laboral",
  familiar: "Familiar",
  consumidor: "Consumidor",
  arrendamiento: "Arrendamiento",
  otro: "Otro",
};

export function DatosHeredadosBanner({ caso, partes }: DatosHeredadosBannerProps) {
  const convocantes = partes.filter((p) => p.rol === "convocante");
  const convocados = partes.filter((p) => p.rol === "convocado");

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
            Datos heredados del expediente
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            Información capturada al radicar la solicitud. No se edita desde el acta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <div className="flex items-start gap-2">
          <Hash className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-[11px] text-blue-600 font-medium uppercase">Radicado</p>
            <p className="text-sm text-[#0D2340] font-semibold">{caso.numero_radicado}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Calendar className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-[11px] text-blue-600 font-medium uppercase">Solicitud</p>
            <ClientDate iso={caso.fecha_solicitud} mode="dateLong" className="text-sm text-[#0D2340]" />
          </div>
        </div>

        {caso.fecha_admision && (
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-[11px] text-blue-600 font-medium uppercase">Admisión</p>
              <ClientDate iso={caso.fecha_admision} mode="dateLong" className="text-sm text-[#0D2340]" />
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Scale className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-[11px] text-blue-600 font-medium uppercase">Materia</p>
            <p className="text-sm text-[#0D2340]">
              {MATERIA_LABEL[caso.materia] ?? caso.materia}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Coins className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
          <div>
            <p className="text-[11px] text-blue-600 font-medium uppercase">Cuantía</p>
            <p className="text-sm text-[#0D2340]">
              {fmtDinero(caso.cuantia, caso.cuantia_indeterminada)}
            </p>
          </div>
        </div>

        {caso.conciliador && (
          <div className="flex items-start gap-2">
            <Users className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-[11px] text-blue-600 font-medium uppercase">Conciliador</p>
              <p className="text-sm text-[#0D2340]">{caso.conciliador.nombre}</p>
              {caso.conciliador.tarjeta_profesional && (
                <p className="text-[11px] text-gray-500">
                  T.P. {caso.conciliador.tarjeta_profesional}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-blue-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] text-blue-600 font-medium uppercase mb-1.5">
            Convocante{convocantes.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {convocantes.map((cp) => (
              <div key={cp.id} className="text-sm">
                <p className="text-[#0D2340] font-medium">
                  {cp.party ? partyDisplayName(cp.party) : "—"}
                </p>
                {cp.party?.numero_doc && (
                  <p className="text-[11px] text-gray-500">
                    {cp.party.tipo_doc} {cp.party.numero_doc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] text-blue-600 font-medium uppercase mb-1.5">
            Convocado{convocados.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1">
            {convocados.map((cp) => (
              <div key={cp.id} className="text-sm">
                <p className="text-[#0D2340] font-medium">
                  {cp.party ? partyDisplayName(cp.party) : "—"}
                </p>
                {cp.party?.numero_doc && (
                  <p className="text-[11px] text-gray-500">
                    {cp.party.tipo_doc} {cp.party.numero_doc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {caso.descripcion && (
        <div className="pt-3 border-t border-blue-200">
          <p className="text-[11px] text-blue-600 font-medium uppercase mb-1">
            Descripción del asunto
          </p>
          <p className="text-sm text-[#0D2340] whitespace-pre-wrap">{caso.descripcion}</p>
        </div>
      )}
    </div>
  );
}
