"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

/* ───────── Tipos ───────── */
type TipoTramite = "conciliacion" | "insolvencia" | "acuerdo_apoyo";
type TipoPersona = "natural" | "juridica";

interface Persona {
  tipo_persona: TipoPersona;
  nombres: string;
  apellidos: string;
  tipo_doc: string;
  numero_doc: string;
  razon_social: string;
  nit_empresa: string;
  representante_legal: string;
  email: string;
  telefono: string;
  ciudad: string;
}

const emptyPersona = (): Persona => ({
  tipo_persona: "natural",
  nombres: "",
  apellidos: "",
  tipo_doc: "CC",
  numero_doc: "",
  razon_social: "",
  nit_empresa: "",
  representante_legal: "",
  email: "",
  telefono: "",
  ciudad: "",
});

const MATERIAS = [
  { value: "civil", label: "Civil" },
  { value: "comercial", label: "Comercial" },
  { value: "laboral", label: "Laboral" },
  { value: "familiar", label: "Familiar" },
  { value: "consumidor", label: "Consumidor" },
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "otro", label: "Otro" },
];

const TRAMITES: { value: TipoTramite; label: string; desc: string }[] = [
  {
    value: "conciliacion",
    label: "Conciliación",
    desc: "Mecanismo alternativo para resolver conflictos de manera rápida, económica y confidencial con la ayuda de un tercero neutral.",
  },
  {
    value: "insolvencia",
    label: "Insolvencia",
    desc: "Procedimiento para personas naturales no comerciantes que no pueden cumplir con sus obligaciones económicas.",
  },
  {
    value: "acuerdo_apoyo",
    label: "Acuerdo de Apoyo",
    desc: "Mecanismo para que personas con discapacidad formalicen actos jurídicos con el apoyo de una persona de confianza.",
  },
];

/* ───────── Estilos reutilizables ───────── */
const navy = "#0D2340";
const gold = "#1B4F9B";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

const btnPrimary: React.CSSProperties = {
  background: navy,
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "12px 32px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.2s",
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: navy,
  border: `1px solid ${navy}`,
  borderRadius: 8,
  padding: "12px 32px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};

/* ───────── Componente principal ───────── */
export default function WidgetPage() {
  const { centerId } = useParams<{ centerId: string }>();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [tipoTramite, setTipoTramite] = useState<TipoTramite | "">("");

  // Step 2
  const [convocante, setConvocante] = useState<Persona>(emptyPersona());

  // Step 3
  const [convocados, setConvocados] = useState<Persona[]>([emptyPersona()]);

  // Step 4
  const [materia, setMateria] = useState("civil");
  const [cuantia, setCuantia] = useState("");
  const [cuantiaIndeterminada, setCuantiaIndeterminada] = useState(false);
  const [descripcion, setDescripcion] = useState("");

  // Step 5
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Step 6
  const [radicado, setRadicado] = useState("");

  /* ── Helpers ── */
  const updateConvocante = (field: keyof Persona, value: string) =>
    setConvocante((p) => ({ ...p, [field]: value }));

  const updateConvocado = (idx: number, field: keyof Persona, value: string) =>
    setConvocados((arr) => arr.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));

  const addConvocado = () => setConvocados((arr) => [...arr, emptyPersona()]);

  const removeConvocado = (idx: number) =>
    setConvocados((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));

  const canNext = (): boolean => {
    if (step === 1) return tipoTramite !== "";
    if (step === 2) {
      if (convocante.tipo_persona === "natural")
        return !!(convocante.nombres && convocante.apellidos && convocante.numero_doc && convocante.email);
      return !!(convocante.razon_social && convocante.nit_empresa && convocante.email);
    }
    if (step === 3) {
      return convocados.every((c) => {
        if (c.tipo_persona === "natural") return !!(c.nombres && c.apellidos && c.email);
        return !!(c.razon_social && c.nit_empresa && c.email);
      });
    }
    if (step === 4) return !!(descripcion.trim());
    if (step === 5) return aceptaTerminos;
    return false;
  };

  const buildPayload = () => {
    const cleanPersona = (p: Persona) => {
      const base: Record<string, unknown> = {
        tipo_persona: p.tipo_persona,
        email: p.email,
        telefono: p.telefono,
        ciudad: p.ciudad,
      };
      if (p.tipo_persona === "natural") {
        base.nombres = p.nombres;
        base.apellidos = p.apellidos;
        base.tipo_doc = p.tipo_doc;
        base.numero_doc = p.numero_doc;
      } else {
        base.razon_social = p.razon_social;
        base.nit_empresa = p.nit_empresa;
        base.representante_legal = p.representante_legal;
      }
      return base;
    };

    return {
      center_id: centerId,
      tipo_tramite: tipoTramite,
      materia,
      cuantia: cuantiaIndeterminada ? null : Number(cuantia) || 0,
      cuantia_indeterminada: cuantiaIndeterminada,
      descripcion,
      convocante: cleanPersona(convocante),
      convocados: convocados.map(cleanPersona),
    };
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/widget/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar solicitud");
      setRadicado(data.radicado);
      setStep(6);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Render de persona (reutilizable) ── */
  const renderPersonaForm = (
    persona: Persona,
    onChange: (field: keyof Persona, value: string) => void,
    label: string,
    idx?: number
  ) => (
    <div key={idx} style={{ marginBottom: 20, padding: 16, background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: navy, fontSize: 14 }}>{label}</span>
        {idx !== undefined && idx > 0 && (
          <button
            type="button"
            onClick={() => removeConvocado(idx)}
            style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Tipo persona */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {(["natural", "juridica"] as TipoPersona[]).map((t) => (
          <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
            <input
              type="radio"
              checked={persona.tipo_persona === t}
              onChange={() => onChange("tipo_persona", t)}
              style={{ accentColor: gold }}
            />
            {t === "natural" ? "Persona Natural" : "Persona Jurídica"}
          </label>
        ))}
      </div>

      {persona.tipo_persona === "natural" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombres *</label>
            <input style={inputStyle} value={persona.nombres} onChange={(e) => onChange("nombres", e.target.value)} placeholder="Juan Carlos" />
          </div>
          <div>
            <label style={labelStyle}>Apellidos *</label>
            <input style={inputStyle} value={persona.apellidos} onChange={(e) => onChange("apellidos", e.target.value)} placeholder="Pérez López" />
          </div>
          <div>
            <label style={labelStyle}>Tipo documento</label>
            <select style={inputStyle} value={persona.tipo_doc} onChange={(e) => onChange("tipo_doc", e.target.value)}>
              <option value="CC">Cédula de Ciudadanía</option>
              <option value="CE">Cédula de Extranjería</option>
              <option value="TI">Tarjeta de Identidad</option>
              <option value="PA">Pasaporte</option>
              <option value="NIT">NIT</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Número documento *</label>
            <input style={inputStyle} value={persona.numero_doc} onChange={(e) => onChange("numero_doc", e.target.value)} placeholder="1234567890" />
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Razón Social *</label>
            <input style={inputStyle} value={persona.razon_social} onChange={(e) => onChange("razon_social", e.target.value)} placeholder="Empresa S.A.S." />
          </div>
          <div>
            <label style={labelStyle}>NIT *</label>
            <input style={inputStyle} value={persona.nit_empresa} onChange={(e) => onChange("nit_empresa", e.target.value)} placeholder="900111222-3" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Representante Legal</label>
            <input style={inputStyle} value={persona.representante_legal} onChange={(e) => onChange("representante_legal", e.target.value)} placeholder="Nombre completo" />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div>
          <label style={labelStyle}>Email *</label>
          <input style={inputStyle} type="email" value={persona.email} onChange={(e) => onChange("email", e.target.value)} placeholder="correo@ejemplo.com" />
        </div>
        <div>
          <label style={labelStyle}>Teléfono</label>
          <input style={inputStyle} type="tel" value={persona.telefono} onChange={(e) => onChange("telefono", e.target.value)} placeholder="+57 300 123 4567" />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Ciudad</label>
          <input style={inputStyle} value={persona.ciudad} onChange={(e) => onChange("ciudad", e.target.value)} placeholder="Bogotá" />
        </div>
      </div>
    </div>
  );

  /* ── Progress bar ── */
  const totalSteps = 6;
  const progress = step <= 5 ? (step / 5) * 100 : 100;

  return (
    <div>
      {/* Progress */}
      {step < 6 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            <span>Paso {step} de 5</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${navy}, ${gold})`, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* ── STEP 1: Tipo de trámite ── */}
      {step === 1 && (
        <div>
          <h2 style={{ color: navy, fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Tipo de trámite</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>Selecciona el tipo de solicitud que deseas realizar</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {TRAMITES.map((t) => (
              <div
                key={t.value}
                onClick={() => setTipoTramite(t.value)}
                style={{
                  padding: 16,
                  border: `2px solid ${tipoTramite === t.value ? gold : "#e5e7eb"}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  background: tipoTramite === t.value ? "#fffbeb" : "white",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontWeight: 600, color: navy, fontSize: 15, marginBottom: 4 }}>{t.label}</div>
                <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Datos convocante ── */}
      {step === 2 && (
        <div>
          <h2 style={{ color: navy, fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Datos del solicitante</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>Información de quien presenta la solicitud (convocante)</p>
          {renderPersonaForm(convocante, updateConvocante, "Convocante")}
        </div>
      )}

      {/* ── STEP 3: Datos convocados ── */}
      {step === 3 && (
        <div>
          <h2 style={{ color: navy, fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Datos del convocado</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>Información de la(s) persona(s) contra quien(es) se presenta la solicitud</p>
          {convocados.map((c, i) => renderPersonaForm(c, (f, v) => updateConvocado(i, f, v), `Convocado ${i + 1}`, i))}
          <button type="button" onClick={addConvocado} style={{ ...btnSecondary, width: "100%", marginTop: 4 }}>
            + Agregar otro convocado
          </button>
        </div>
      )}

      {/* ── STEP 4: Descripción del caso ── */}
      {step === 4 && (
        <div>
          <h2 style={{ color: navy, fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Descripción del caso</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>Detalla la materia, cuantía y descripción de tu solicitud</p>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Materia</label>
            <select style={inputStyle} value={materia} onChange={(e) => setMateria(e.target.value)}>
              {MATERIAS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Cuantía (COP)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                style={{ ...inputStyle, flex: 1, opacity: cuantiaIndeterminada ? 0.4 : 1 }}
                type="number"
                value={cuantia}
                onChange={(e) => setCuantia(e.target.value)}
                placeholder="15000000"
                disabled={cuantiaIndeterminada}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: "#6b7280", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={cuantiaIndeterminada}
                onChange={(e) => setCuantiaIndeterminada(e.target.checked)}
                style={{ accentColor: gold }}
              />
              Cuantía indeterminada
            </label>
          </div>

          <div>
            <label style={labelStyle}>Descripción del conflicto *</label>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe brevemente los hechos y la pretensión de tu solicitud..."
            />
          </div>
        </div>
      )}

      {/* ── STEP 5: Confirmación ── */}
      {step === 5 && (
        <div>
          <h2 style={{ color: navy, fontSize: 20, marginBottom: 4, fontWeight: 700 }}>Confirma tu solicitud</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>Revisa los datos antes de enviar</p>

          <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", padding: 16, fontSize: 14, lineHeight: 1.8 }}>
            <div><strong>Trámite:</strong> {TRAMITES.find((t) => t.value === tipoTramite)?.label}</div>
            <div><strong>Materia:</strong> {MATERIAS.find((m) => m.value === materia)?.label}</div>
            <div><strong>Cuantía:</strong> {cuantiaIndeterminada ? "Indeterminada" : `$${Number(cuantia || 0).toLocaleString("es-CO")}`}</div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <div style={{ fontWeight: 600, color: navy, marginBottom: 4 }}>Convocante</div>
            <div>
              {convocante.tipo_persona === "natural"
                ? `${convocante.nombres} ${convocante.apellidos} — ${convocante.tipo_doc} ${convocante.numero_doc}`
                : `${convocante.razon_social} — NIT ${convocante.nit_empresa}`}
            </div>
            <div>{convocante.email} {convocante.telefono && `| ${convocante.telefono}`}</div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <div style={{ fontWeight: 600, color: navy, marginBottom: 4 }}>Convocado(s)</div>
            {convocados.map((c, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div>
                  {c.tipo_persona === "natural"
                    ? `${c.nombres} ${c.apellidos}`
                    : `${c.razon_social} — NIT ${c.nit_empresa}`}
                </div>
                <div style={{ color: "#6b7280" }}>{c.email}</div>
              </div>
            ))}

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <div style={{ fontWeight: 600, color: navy, marginBottom: 4 }}>Descripción</div>
            <div style={{ whiteSpace: "pre-line", color: "#374151" }}>{descripcion}</div>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, fontSize: 13, cursor: "pointer", lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              style={{ accentColor: gold, marginTop: 2 }}
            />
            <span>
              Acepto los términos y condiciones del servicio y autorizo el tratamiento de mis datos personales
              conforme a la Ley 1581 de 2012.
            </span>
          </label>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginTop: 12, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 6: Éxito ── */}
      {step === 6 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ width: 64, height: 64, background: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 32 }}>
            ✓
          </div>
          <h2 style={{ color: navy, fontSize: 22, marginBottom: 8, fontWeight: 700 }}>Solicitud enviada correctamente</h2>
          <p style={{ color: "#6b7280", fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
            Tu solicitud ha sido recibida por el centro de conciliación.
          </p>

          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Tu número de radicado es:</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: navy, letterSpacing: 2 }}>{radicado}</div>
          </div>

          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
            Te contactaremos al correo <strong>{convocante.email}</strong> con más información sobre el proceso.
          </p>
        </div>
      )}

      {/* ── Navigation buttons ── */}
      {step < 6 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} style={btnSecondary}>
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
              style={{ ...btnPrimary, opacity: canNext() ? 1 : 0.4, cursor: canNext() ? "pointer" : "not-allowed" }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext() || loading}
              onClick={handleSubmit}
              style={{ ...btnPrimary, background: gold, opacity: canNext() && !loading ? 1 : 0.4, cursor: canNext() && !loading ? "pointer" : "not-allowed" }}
            >
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
