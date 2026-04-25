"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface StaffRow {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: string;
  tiene_password: boolean;
  casos: number;
  audiencias: number;
}

interface Props {
  grupos: StaffRow[][];
}

export function StaffDuplicadosClient({ grupos }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seleccion, setSeleccion] = useState<Map<number, { desde?: string; hacia?: string }>>(new Map());
  const [resultado, setResultado] = useState<{ tipo: "ok" | "error"; mensaje: string } | null>(null);

  function setSeleccionGrupo(grupoIdx: number, campo: "desde" | "hacia", id: string) {
    setSeleccion((prev) => {
      const next = new Map(prev);
      const actual = next.get(grupoIdx) ?? {};
      next.set(grupoIdx, { ...actual, [campo]: id });
      return next;
    });
  }

  async function fusionar(grupoIdx: number) {
    const sel = seleccion.get(grupoIdx);
    if (!sel?.desde || !sel?.hacia) return;
    if (sel.desde === sel.hacia) return;

    if (!confirm(
      "Vas a mover todos los casos y audiencias de la cuenta DESDE → HACIA, y desactivar la cuenta DESDE. Esta acción no se puede deshacer fácilmente. ¿Continuar?",
    )) return;

    setResultado(null);
    try {
      const res = await fetch("/api/admin/staff/fusionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desde_staff_id: sel.desde, hacia_staff_id: sel.hacia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultado({ tipo: "error", mensaje: data?.error ?? "Error al fusionar" });
        return;
      }
      const m = data.movidos;
      setResultado({
        tipo: "ok",
        mensaje: `Fusión exitosa: ${m.casos_conciliador} caso(s) como conciliador, ${m.casos_secretario} como secretario, ${m.audiencias} audiencia(s) movidas. Cuenta DESDE desactivada.`,
      });
      startTransition(() => router.refresh());
    } catch {
      setResultado({ tipo: "error", mensaje: "Error de conexión" });
    }
  }

  if (grupos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-70" />
        <p className="text-sm">No detectamos cuentas con nombres similares en este centro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {resultado && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
            resultado.tipo === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {resultado.tipo === "ok" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{resultado.mensaje}</span>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          La fusión mueve TODOS los casos y audiencias de la cuenta <strong>DESDE</strong> a la cuenta <strong>HACIA</strong>, y desactiva la primera. Recomendado: elegir como <strong>HACIA</strong> la cuenta con el correo que el conciliador realmente usa para iniciar sesión.
        </div>
      </div>

      {grupos.map((grupo, gi) => {
        const sel = seleccion.get(gi) ?? {};
        const puedeFusionar = !!sel.desde && !!sel.hacia && sel.desde !== sel.hacia;
        return (
          <div key={gi} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-[#0D2340]">{grupo[0].nombre}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{grupo.length} cuentas con este nombre</p>
            </div>

            <div className="divide-y divide-gray-100">
              {grupo.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 mt-0.5">
                      <span>Rol: <strong>{s.rol}</strong></span>
                      <span>Casos: <strong>{s.casos}</strong></span>
                      <span>Audiencias: <strong>{s.audiencias}</strong></span>
                      <span>{s.activo ? "Activa" : "Inactiva"}</span>
                      <span>{s.tiene_password ? "Con contraseña" : "Sin contraseña"}</span>
                      <span>Creada {new Date(s.created_at).toLocaleDateString("es-CO")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`desde-${gi}`}
                        checked={sel.desde === s.id}
                        onChange={() => setSeleccionGrupo(gi, "desde", s.id)}
                        disabled={pending}
                      />
                      Desde
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`hacia-${gi}`}
                        checked={sel.hacia === s.id}
                        onChange={() => setSeleccionGrupo(gi, "hacia", s.id)}
                        disabled={pending}
                      />
                      Hacia
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              {sel.desde && sel.hacia && sel.desde === sel.hacia && (
                <span className="text-[11px] text-red-600 mr-auto">Desde y Hacia deben ser distintas</span>
              )}
              <button
                type="button"
                onClick={() => fusionar(gi)}
                disabled={!puedeFusionar || pending}
                className="inline-flex items-center gap-1.5 bg-[#0D2340] text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-[#1B4F9B] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Fusionar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
