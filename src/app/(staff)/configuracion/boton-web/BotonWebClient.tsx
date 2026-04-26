"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Link as LinkIcon, ExternalLink, Code, Sparkles } from "lucide-react";

interface Props {
  codigo: string;
  nombreCentro: string;
  colorPrimario: string;
  colorSecundario: string;
  origin: string;
}

type Variante = "inline" | "fab" | "url";

export function BotonWebClient({ codigo, nombreCentro, colorPrimario, colorSecundario, origin }: Props) {
  const [variante, setVariante] = useState<Variante>("inline");
  const [copiado, setCopiado] = useState(false);
  const [textoCustom, setTextoCustom] = useState(`Trámites en línea — ${nombreCentro}`);

  const url = `${origin}/centro/${codigo}`;

  const snippet = useMemo(() => {
    if (variante === "url") {
      return url;
    }

    if (variante === "inline") {
      return `<a href="${url}"
   target="_blank" rel="noopener"
   style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:${colorPrimario};color:#fff;text-decoration:none;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:transform .15s">
  <span>${textoCustom}</span>
  <span style="font-size:18px;line-height:1">→</span>
</a>`;
    }

    // FAB (botón flotante)
    return `<!-- SGCC: botón flotante de trámites en línea -->
<a id="sgcc-fab" href="${url}" target="_blank" rel="noopener"
   style="position:fixed;bottom:20px;right:20px;z-index:9999;display:inline-flex;align-items:center;gap:8px;padding:12px 18px;background:${colorPrimario};color:#fff;text-decoration:none;border-radius:999px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:transform .15s,box-shadow .15s"
   onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.22)'"
   onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.18)'">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  <span>${textoCustom}</span>
</a>`;
  }, [variante, url, colorPrimario, textoCustom]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector de variante */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-[#0D2340] mb-3">Tipo de botón</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { id: "inline", label: "Botón en línea", desc: "Lo pegas donde quieras dentro de la página", Icon: Code },
            { id: "fab", label: "Botón flotante", desc: "Aparece fijo en la esquina inferior derecha", Icon: Sparkles },
            { id: "url", label: "Solo URL", desc: "Para usar como enlace en menú o boletín", Icon: LinkIcon },
          ].map((opt) => {
            const active = variante === (opt.id as Variante);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVariante(opt.id as Variante)}
                className={`text-left p-3 rounded-lg border-2 transition-all ${
                  active
                    ? "border-[#1B4F9B] bg-[#1B4F9B]/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <opt.Icon className={`w-4 h-4 ${active ? "text-[#1B4F9B]" : "text-gray-400"}`} />
                  <span className="text-sm font-semibold text-[#0D2340]">{opt.label}</span>
                </div>
                <p className="text-[11px] text-gray-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Texto customizable (solo inline/fab) */}
      {variante !== "url" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Texto del botón
          </label>
          <input
            type="text"
            value={textoCustom}
            onChange={(e) => setTextoCustom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1B4F9B] focus:ring-2 focus:ring-[#1B4F9B]/20"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Recomendado: incluir el nombre del centro o "Trámites en línea".
          </p>
        </div>
      )}

      {/* Vista previa */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-[#0D2340] mb-3">Vista previa</h3>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 flex items-center justify-center min-h-[120px] relative overflow-hidden">
          {variante === "url" ? (
            <code className="text-xs text-[#0D2340] bg-white px-3 py-2 rounded border border-gray-200 break-all max-w-full">
              {url}
            </code>
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noopener"
              className={
                variante === "fab"
                  ? "absolute bottom-4 right-4"
                  : ""
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: variante === "fab" ? "12px 18px" : "12px 20px",
                background: colorPrimario,
                color: "#fff",
                textDecoration: "none",
                borderRadius: variante === "fab" ? 999 : 10,
                fontSize: 14,
                fontWeight: 600,
                boxShadow:
                  variante === "fab"
                    ? "0 4px 16px rgba(0,0,0,.18)"
                    : "0 2px 8px rgba(0,0,0,.12)",
              }}
            >
              <span>{textoCustom}</span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </a>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-2 inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          Abre en nueva pestaña: <span className="font-mono text-gray-700">{url}</span>
        </p>
      </div>

      {/* Snippet */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#0D2340]">Código para copiar</h3>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 bg-[#0D2340] text-white text-xs font-medium rounded-lg px-3 py-1.5 hover:bg-[#1B4F9B] transition-colors"
          >
            {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">
          {snippet}
        </pre>
        <p className="text-[11px] text-gray-500 mt-3">
          {variante === "inline" && "Pega este HTML donde quieras que aparezca el botón en tu sitio web."}
          {variante === "fab" && "Pega este HTML al final de tu <body>. El botón quedará flotando en la esquina inferior derecha en TODAS las páginas."}
          {variante === "url" && "Usa esta URL como enlace en menús, boletines, redes sociales o donde gustes."}
        </p>
      </div>
    </div>
  );
}
