"use client";

import { useEffect, useMemo, useState } from "react";
import { Puzzle, Search, X, Loader2, Globe, Building } from "lucide-react";
import type {
  SgccClausula,
  ClausulaCategoria,
  TipoTramite,
  ActaTipo,
} from "@/types";
import { CLAUSULA_CATEGORIA_LABEL } from "@/types";

interface Props {
  /**
   * Trámite para pre-filtrar (null = cualquier trámite).
   */
  tipoTramite?: TipoTramite | null;
  /**
   * Resultado actual de la acta (null = cualquiera).
   * Filtra cláusulas cuya `resultado_aplicable` sea null o incluya este valor.
   */
  resultado?: ActaTipo | null;
  /**
   * Categorías a mostrar por defecto. Si no se define, se muestran todas.
   * Ej: ["consideraciones"] cuando se inserta en el campo "consideraciones".
   */
  categoriasPreferidas?: ClausulaCategoria[];
  /**
   * Texto del botón disparador.
   */
  label?: string;
  /**
   * Se llama al seleccionar una cláusula con su contenido crudo (con tokens sin reemplazar).
   */
  onInsert: (contenido: string, clausula: SgccClausula) => void;
}

export function InsertarClausulaButton({
  tipoTramite,
  resultado,
  categoriasPreferidas,
  label = "Insertar cláusula",
  onInsert,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clausulas, setClausulas] = useState<SgccClausula[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<ClausulaCategoria | "">(
    categoriasPreferidas?.length === 1 ? categoriasPreferidas[0] : ""
  );

  // Cargar cláusulas solo cuando abre el modal
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (tipoTramite) params.set("tipo_tramite", tipoTramite);
        if (resultado) params.set("resultado", resultado);
        const res = await fetch(`/api/clausulas?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudieron cargar las cláusulas");
        const data = await res.json();
        if (!cancelled) setClausulas(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tipoTramite, resultado]);

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clausulas.filter((c) => {
      if (categoria && c.categoria !== categoria) return false;
      if (q) {
        const haystack = `${c.titulo} ${c.contenido} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [clausulas, categoria, busqueda]);

  const categoriasDisponibles = useMemo(() => {
    const unique = Array.from(new Set(clausulas.map((c) => c.categoria))) as ClausulaCategoria[];
    if (categoriasPreferidas?.length) {
      return unique.sort((a, b) => {
        const aPreferida = categoriasPreferidas.includes(a) ? 0 : 1;
        const bPreferida = categoriasPreferidas.includes(b) ? 0 : 1;
        return aPreferida - bPreferida;
      });
    }
    return unique;
  }, [clausulas, categoriasPreferidas]);

  function handleSelect(c: SgccClausula) {
    onInsert(c.contenido, c);
    setOpen(false);
    setBusqueda("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B4F9B] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <Puzzle className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-[#0D2340]">
                  Insertar cláusula
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Selecciona una cláusula para copiar su contenido al documento.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filtros */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por título o contenido…"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#1B4F9B]/30 focus:border-[#1B4F9B] outline-none"
                  autoFocus
                />
              </div>
              {categoriasDisponibles.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategoria("")}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      categoria === ""
                        ? "bg-[#1B4F9B] border-[#1B4F9B] text-white"
                        : "border-gray-300 text-gray-600 hover:border-[#1B4F9B]"
                    }`}
                  >
                    Todas
                  </button>
                  {categoriasDisponibles.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoria(c)}
                      className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                        categoria === c
                          ? "bg-[#1B4F9B] border-[#1B4F9B] text-white"
                          : "border-gray-300 text-gray-600 hover:border-[#1B4F9B]"
                      }`}
                    >
                      {CLAUSULA_CATEGORIA_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Cargando cláusulas…</span>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No hay cláusulas que coincidan con los filtros.
                </div>
              )}
              {!loading && !error && filtered.map((c) => {
                const isGlobal = !c.center_id;
                const preview = c.contenido.length > 180 ? c.contenido.slice(0, 180) + "…" : c.contenido;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#1B4F9B] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-sm font-medium text-[#0D2340] flex-1">{c.titulo}</p>
                      {isGlobal ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                          <Globe className="w-3 h-3" /> Global
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex-shrink-0">
                          <Building className="w-3 h-3" /> Centro
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mb-1.5">
                      {CLAUSULA_CATEGORIA_LABEL[c.categoria]}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">
                      {preview}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
