"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

/* ───── tipos ───── */

interface PlanData {
  name: string;
  prefix: string;
  target: string;
  priceMonthly: string;
  priceAnnual: string;
  priceNoteMonthly: string;
  priceNoteAnnual: string;
  cta: string;
  href: string;
  features: string[];
  badge?: string;
}

/* ───── 5 tiers SIGECC ───── */

const PLANS: PlanData[] = [
  {
    name: "Académico",
    prefix: "ACA",
    target: "Consultorios jurídicos universitarios",
    priceMonthly: "Gratis",
    priceAnnual: "Gratis",
    priceNoteMonthly: "sin costo",
    priceNoteAnnual: "sin costo",
    cta: "Empezar gratis",
    href: "/registro",
    badge: "Académico gratis",
    features: [
      "50 casos / año",
      "5 personas",
      "Conciliación + acuerdos de apoyo",
      "Plantillas y actas",
      "Portal de partes",
      "Soporte por correo",
    ],
  },
  {
    name: "Privado Esencial",
    prefix: "ESE",
    target: "Centro privado pequeño / notarial",
    priceMonthly: "$490.000",
    priceAnnual: "$392.000",
    priceNoteMonthly: "COP / mes",
    priceNoteAnnual: "COP / mes (-20%)",
    cta: "Empezar prueba",
    href: "/registro",
    features: [
      "100 casos / año",
      "5 personas",
      "Insolvencia (Ley 2445)",
      "Audiencias virtuales (Dec. 1136)",
      "Portal partes + widget",
      "SICAAC + radicado",
      "Soporte 8x5",
    ],
  },
  {
    name: "Privado Profesional",
    prefix: "PRO",
    target: "Centro privado mediano",
    priceMonthly: "$1.090.000",
    priceAnnual: "$872.000",
    priceNoteMonthly: "COP / mes",
    priceNoteAnnual: "COP / mes (-20%)",
    cta: "Empezar prueba",
    href: "/registro",
    badge: "Más popular",
    features: [
      "400 casos / año",
      "15 personas",
      "Reglamento interno digital",
      "Firma electrónica integrada",
      "Plantillas avanzadas",
      "Sugerencia automática agendas",
      "Soporte prioritario",
    ],
  },
  {
    name: "Notarial / Multi-sede",
    prefix: "NOT",
    target: "Notarías + red multi-sede",
    priceMonthly: "$1.990.000",
    priceAnnual: "$1.592.000",
    priceNoteMonthly: "COP / mes",
    priceNoteAnnual: "COP / mes (-20%)",
    cta: "Empezar prueba",
    href: "/registro",
    features: [
      "800 casos / año",
      "25 personas",
      "Multi-sede consolidado",
      "Roles multi-centro",
      "Reportes ejecutivos",
      "Integración SICAAC + Rama Judicial",
      "Onboarding asistido",
    ],
  },
  {
    name: "Enterprise",
    prefix: "ENT",
    target: "Cámaras y redes de centros",
    priceMonthly: "$3.500.000+",
    priceAnnual: "Cotizar",
    priceNoteMonthly: "desde / mes",
    priceNoteAnnual: "personalizado",
    cta: "Cotizar",
    href: "mailto:ventas@sigecc.co?subject=Cotización%20Enterprise",
    badge: "Cotizar",
    features: [
      "Casos ilimitados",
      "Personas ilimitadas",
      "SLA dedicado 99.9%",
      "Onboarding + capacitación",
      "Integraciones a medida",
      "Account manager",
      "Despliegue regional",
    ],
  },
];

/* ───── helpers tarjeta visual ───── */

function rand4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function genCardNumber() {
  return `${rand4()} ${rand4()} ${rand4()} ${rand4()}`;
}

function genId(prefix: string) {
  return `SIG-${prefix}-2026-${rand4()}`;
}

/* ───── tarjeta visual estilo bank card ───── */

function CenterCard({
  planIndex,
  id,
  cardNum,
  name,
}: {
  planIndex: number;
  id: string;
  cardNum: string;
  name: string;
}) {
  const styles: Record<
    number,
    {
      bg: string;
      chip: string;
      chipInner?: string;
      numColor: string;
      numShadow: string;
      border?: string;
    }
  > = {
    // Escala azul/navy SIGECC, de claro→oscuro según jerarquía/precio.
    // Académico — azul claro (entrada, free)
    0: {
      bg: "linear-gradient(135deg, #6B8FCF, #3A6EBE 45%, #4D7AC4)",
      chip: "linear-gradient(135deg, #1B4F9B, #13407F)",
      numColor: "#EAF1FB",
      numShadow: "1px 1px 2px rgba(10,30,80,0.6), 0 0 1px rgba(10,30,80,0.3)",
    },
    // Esencial — azul SIGECC
    1: {
      bg: "linear-gradient(135deg, #3A6EBE, #1B4F9B 45%, #2A60AE)",
      chip: "linear-gradient(135deg, #0D2340, #13407F)",
      numColor: "#DCE8FA",
      numShadow: "1px 1px 2px rgba(10,30,80,0.7), 0 0 1px rgba(10,30,80,0.4)",
    },
    // Profesional — Navy SIGECC (destacado)
    2: {
      bg: "linear-gradient(135deg, #1B4F9B, #0D2340 45%, #13407F)",
      chip: "linear-gradient(135deg, #1B4F9B, #3A6EBE)",
      chipInner: "linear-gradient(135deg, #DCE8FA, #6B8FCF)",
      numColor: "#FFFFFF",
      numShadow: "1px 1px 2px rgba(5,15,40,0.85), 0 0 1px rgba(5,15,40,0.5)",
    },
    // Notarial — Navy oscuro / ink
    3: {
      bg: "linear-gradient(135deg, #0D2340, #0a1628 45%, #13407F)",
      chip: "linear-gradient(135deg, #1B4F9B, #3A6EBE)",
      numColor: "#DCE8FA",
      numShadow: "1px 1px 2px rgba(5,15,40,0.9), 0 0 1px rgba(5,15,40,0.5)",
    },
    // Enterprise — Negro / ink absoluto
    4: {
      bg: "linear-gradient(135deg, #0a1628, #000000 50%, #0a1628)",
      chip: "linear-gradient(135deg, #1B4F9B, #13407F)",
      chipInner: "linear-gradient(135deg, #6B8FCF, #1B4F9B)",
      numColor: "#FFFFFF",
      numShadow: "1px 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)",
      border: "1px solid #1f2937",
    },
  };

  const s = styles[planIndex];
  if (!s) return null;

  return (
    <div
      style={{
        aspectRatio: "1.586 / 1",
        width: "100%",
        background: s.bg,
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        border: s.border || "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          fontSize: 14,
          fontWeight: 900,
          color: "rgba(255,255,255,0.18)",
          letterSpacing: 1,
        }}
      >
        SIGECC
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 42,
            height: 32,
            borderRadius: 6,
            background: s.chip,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 30,
              height: 22,
              borderRadius: 4,
              background: s.chipInner || "rgba(255,255,255,0.2)",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#fff",
            textShadow: planIndex === 4 ? "0 1px 3px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {name}
        </div>
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "monospace",
          color: s.numColor,
          textShadow: s.numShadow,
          letterSpacing: 3,
        }}
      >
        {cardNum}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div
            style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.5)",
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            CENTRO · {id}
          </div>
        </div>
        {/* Símbolo escala — alusión a conciliación */}
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <line
            x1="16"
            y1="6"
            x2="16"
            y2="24"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="12"
            x2="26"
            y2="12"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="9" cy="18" r="3" fill="#1B4F9B" />
          <circle cx="23" cy="18" r="3" fill="#1B4F9B" />
        </svg>
      </div>
    </div>
  );
}

const BOX_STYLES: Record<
  number,
  {
    badgeBg: string;
    badgeColor: string;
    priceColor: string;
    btnBg: string;
    btnColor: string;
  }
> = {
  // Badges/botones por plan — escala azul SIGECC, badgeBg en tonos muy suaves.
  0: { badgeBg: "#EAF1FB", badgeColor: "#3A6EBE", priceColor: "#3A6EBE", btnBg: "#3A6EBE", btnColor: "#fff" },
  1: { badgeBg: "#dbeafe", badgeColor: "#1B4F9B", priceColor: "#1B4F9B", btnBg: "#1B4F9B", btnColor: "#fff" },
  2: { badgeBg: "#dbeafe", badgeColor: "#0D2340", priceColor: "#0D2340", btnBg: "#0D2340", btnColor: "#fff" },
  3: { badgeBg: "#E2E8F0", badgeColor: "#0a1628", priceColor: "#0a1628", btnBg: "#0a1628", btnColor: "#fff" },
  4: { badgeBg: "#f1f5f9", badgeColor: "#0a1628", priceColor: "#0a1628", btnBg: "#000000", btnColor: "#fff" },
};

export function PricingCarousel({ anual = false }: { anual?: boolean } = {}) {
  const [cur, setCur] = useState(2); // Profesional centrado por defecto
  const [ids, setIds] = useState<string[]>([]);
  const [cardNums, setCardNums] = useState<string[]>([]);
  const touchRef = useRef<number | null>(null);

  useEffect(() => {
    setIds(PLANS.map((p) => genId(p.prefix)));
    setCardNums(PLANS.map(() => genCardNumber()));
  }, []);

  const go = useCallback((n: number) => {
    setCur(Math.max(0, Math.min(PLANS.length - 1, n)));
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchRef.current === null) return;
    const diff = touchRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      go(cur + (diff > 0 ? 1 : -1));
    }
    touchRef.current = null;
  };

  const mounted = ids.length > 0;
  const SLIDE_PCT = 74;
  const GAP_PCT = 3;

  return (
    <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingTop: 80 }}>
        <button
          onClick={() => go(cur - 1)}
          disabled={cur === 0}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: 20,
            color: cur === 0 ? "#cbd5e1" : "#0D2340",
            cursor: cur === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            flexShrink: 0,
            boxShadow: cur === 0 ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
          }}
          aria-label="Plan anterior"
        >
          ‹
        </button>

        <div
          style={{ overflow: "hidden", position: "relative", flex: 1 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            style={{
              display: "flex",
              gap: `${GAP_PCT}%`,
              transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: `translateX(${(100 - SLIDE_PCT) / 2 - cur * (SLIDE_PCT + GAP_PCT)}%)`,
            }}
          >
            {PLANS.map((plan, i) => {
              const isActive = i === cur;
              const box = BOX_STYLES[i];
              const price = anual ? plan.priceAnnual : plan.priceMonthly;
              const note = anual ? plan.priceNoteAnnual : plan.priceNoteMonthly;

              return (
                <div
                  key={plan.prefix}
                  style={{
                    flex: `0 0 ${SLIDE_PCT}%`,
                    transition: "opacity 0.4s, transform 0.4s",
                    opacity: isActive ? 1 : 0.4,
                    transform: isActive ? "scale(1)" : "scale(0.91)",
                    cursor: isActive ? "default" : "pointer",
                  }}
                  onClick={() => !isActive && go(i)}
                >
                  <CenterCard
                    planIndex={i}
                    id={mounted ? ids[i] : "..."}
                    cardNum={mounted ? cardNums[i] : "..."}
                    name={plan.name}
                  />

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: "20px 18px",
                      marginTop: 12,
                    }}
                  >
                    {plan.badge && (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: box.badgeBg,
                          color: box.badgeColor,
                          marginBottom: 8,
                        }}
                      >
                        {plan.badge}
                      </span>
                    )}

                    <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>
                      {plan.target}
                    </div>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: box.priceColor }}>
                        {price}
                      </span>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{note}</span>
                    </div>

                    <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 16px" }}>
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            padding: "3px 0",
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span style={{ color: box.btnBg, fontSize: 14, fontWeight: 700 }}>
                            ✓
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={plan.href}
                      style={{
                        display: "block",
                        textAlign: "center",
                        textDecoration: "none",
                        width: "100%",
                        padding: "12px 0",
                        border: "none",
                        borderRadius: 10,
                        background: box.btnBg,
                        color: box.btnColor,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => go(cur + 1)}
          disabled={cur === PLANS.length - 1}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontSize: 20,
            color: cur === PLANS.length - 1 ? "#cbd5e1" : "#0D2340",
            cursor: cur === PLANS.length - 1 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            flexShrink: 0,
            boxShadow: cur === PLANS.length - 1 ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
          }}
          aria-label="Plan siguiente"
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 16,
        }}
      >
        {PLANS.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            style={{
              width: i === cur ? 22 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: i === cur ? "#0D2340" : "#cbd5e1",
              cursor: "pointer",
              transition: "all 0.3s",
              padding: 0,
            }}
            aria-label={`Plan ${i + 1}`}
          />
        ))}
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 8,
          fontSize: 13,
          color: "#64748b",
          fontWeight: 600,
        }}
      >
        Plan {PLANS[cur].name} · {cur + 1} de {PLANS.length}
      </div>
    </div>
  );
}
