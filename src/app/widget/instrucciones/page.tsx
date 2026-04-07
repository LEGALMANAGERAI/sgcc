"use client";

import { useState } from "react";

const navy = "#0D2340";
const gold = "#1B4F9B";

const EMBED_URL = "https://sgcc-rouge.vercel.app/api/widget/embed";

export default function InstruccionesPage() {
  const [centerId, setCenterId] = useState("TU_CENTER_ID");
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="${EMBED_URL}" data-center-id="${centerId}"></script>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ color: navy, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
            Integra SGCC en tu página web
          </h1>
          <p style={{ color: "#6b7280", fontSize: 16, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
            Permite que los ciudadanos soliciten conciliaciones directamente desde tu sitio web
            con un widget embebible fácil de instalar.
          </p>
        </div>

        {/* Pasos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Paso 1 */}
          <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: navy, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                1
              </div>
              <h2 style={{ color: navy, fontSize: 18, fontWeight: 700, margin: 0 }}>Obtén tu Center ID</h2>
            </div>
            <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Ve a <strong>Configuración</strong> en tu panel de administración de SGCC.
              Tu Center ID aparece en la sección de datos del centro. Es un identificador
              único tipo UUID (ej: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>).
            </p>
          </div>

          {/* Paso 2 */}
          <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: navy, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                2
              </div>
              <h2 style={{ color: navy, fontSize: 18, fontWeight: 700, margin: 0 }}>Copia el código</h2>
            </div>

            <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              Ingresa tu Center ID y copia el snippet de código:
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Tu Center ID
              </label>
              <input
                type="text"
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <pre
                style={{
                  background: "#1e293b",
                  color: "#e2e8f0",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 13,
                  overflow: "auto",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                <code>{snippet}</code>
              </pre>
              <button
                onClick={handleCopy}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: copied ? "#22c55e" : gold,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Paso 3 */}
          <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: navy, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                3
              </div>
              <h2 style={{ color: navy, fontSize: 18, fontWeight: 700, margin: 0 }}>Pega el código en tu web</h2>
            </div>
            <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Agrega el snippet justo antes del cierre de la etiqueta{" "}
              <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>&lt;/body&gt;</code>{" "}
              en tu sitio web. El widget aparecerá como un botón flotante en la esquina inferior derecha
              de tu página.
            </p>
          </div>

          {/* Preview */}
          <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
            <h2 style={{ color: navy, fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>
              Vista previa del botón
            </h2>
            <div
              style={{
                background: "#f9fafb",
                borderRadius: 8,
                padding: 48,
                position: "relative",
                minHeight: 120,
                border: "1px dashed #d1d5db",
              }}
            >
              <p style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", margin: 0 }}>
                Tu página web
              </p>
              <div
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  background: navy,
                  color: "white",
                  padding: "14px 24px",
                  borderRadius: 50,
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  cursor: "default",
                }}
              >
                ⚖️ Solicitar Conciliación
              </div>
            </div>
          </div>

          {/* Nota */}
          <div style={{ background: "#fffbeb", borderRadius: 12, padding: 20, border: "1px solid #fde68a" }}>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14, marginBottom: 8 }}>
              Nota importante
            </div>
            <ul style={{ color: "#78350f", fontSize: 14, lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
              <li>
                Reemplaza <code style={{ background: "#fef3c7", padding: "1px 4px", borderRadius: 3 }}>TU_CENTER_ID</code> con
                el ID real de tu centro.
              </li>
              <li>Tu centro debe estar en estado <strong>activo</strong> para recibir solicitudes.</li>
              <li>
                El widget funciona en cualquier sitio web: WordPress, Wix, HTML estático, etc.
              </li>
              <li>
                Las solicitudes recibidas aparecerán en tu panel de SGCC con estado &quot;solicitud&quot;.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
