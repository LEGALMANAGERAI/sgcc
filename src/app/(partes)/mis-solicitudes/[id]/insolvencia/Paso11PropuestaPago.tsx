"use client";
import { useMemo } from "react";
import type { WizardProps } from "../WizardShell";
import type {
  AcreedorFormData,
  ClasePrelacion,
  CondonacionesConfig,
  FormDataInsolvencia,
  PropuestaPagoClase,
  PropuestaPagoCredito,
  TipoAmortizacion,
} from "@/types/solicitudes";
import { CLASE_PRELACION_LABEL } from "@/lib/solicitudes/constants";
import {
  generarCronograma,
  generarCronogramaPrioridadPequenos,
  generarCronogramaProrrataQuinta,
  generarRedaccionCondonaciones,
  generarRedaccionCredito,
  tasaMensualAEA,
  totalesDeCronograma,
} from "@/lib/solicitudes/payment-plan";
import { calcularPequenosAcreedores } from "@/lib/solicitudes/small-creditor";

const CLASES_ORDEN: ClasePrelacion[] = ["primera", "segunda", "tercera", "cuarta", "quinta"];

type AcreedorConIndice = AcreedorFormData & { __index: number };

export function Paso11PropuestaPago({ formData, updateFormData }: WizardProps) {
  const fd = formData as Partial<FormDataInsolvencia>;
  const acreedores = fd.acreedores ?? [];
  const propuestas = fd.propuesta_pago ?? [];
  const condonaciones = fd.condonaciones_globales;

  const acreedoresSinTasa = acreedores
    .map((a, i) => ({ ...a, __index: i }))
    .filter((a) => a.clase_prelacion && (!a.tasa_interes_mensual || a.tasa_interes_mensual <= 0));

  const acreedoresPorClase = useMemo(() => {
    const m = new Map<ClasePrelacion, AcreedorConIndice[]>();
    acreedores.forEach((a, i) => {
      if (!a.clase_prelacion) return;
      const arr = m.get(a.clase_prelacion) ?? [];
      arr.push({ ...a, __index: i });
      m.set(a.clase_prelacion, arr);
    });
    return m;
  }, [acreedores]);

  const clasesActivas = CLASES_ORDEN.filter((c) => (acreedoresPorClase.get(c)?.length ?? 0) > 0);

  // ------------ KPIs globales ------------
  const kpis = useMemo(() => {
    const capitalPasivo = acreedores.reduce((s, a) => s + (a.capital || 0), 0);
    let totalAPagar = 0;
    let totalIntereses = 0;
    let plazoMaxMeses = 0;
    for (const p of propuestas) {
      for (const c of p.creditos) {
        const t = totalesDeCronograma(c.cronograma);
        totalAPagar += t.total;
        totalIntereses += t.intereses;
        const ultimoMes = c.cronograma.length > 0 ? c.cronograma[c.cronograma.length - 1].mes_relativo : 0;
        if (ultimoMes > plazoMaxMeses) plazoMaxMeses = ultimoMes;
      }
    }
    return { capitalPasivo, totalAPagar, totalIntereses, plazoMaxMeses };
  }, [acreedores, propuestas]);

  // ------------ Acceso / actualización de propuestas ------------

  function reemplazarClase(next: PropuestaPagoClase) {
    const otras = propuestas.filter((p) => p.clase_prelacion !== next.clase_prelacion);
    updateFormData({ propuesta_pago: [...otras, next] });
  }

  function actualizarCondonaciones(patch: Partial<CondonacionesConfig>) {
    const base: CondonacionesConfig = condonaciones ?? {
      intereses_corrientes: false,
      intereses_moratorios: false,
      otros_conceptos_distintos_capital: false,
    };
    updateFormData({ condonaciones_globales: { ...base, ...patch } });
  }

  // ------------ Clases 1ª a 4ª ------------

  function asegurarCreditoClase14(clase: ClasePrelacion, ac: AcreedorConIndice): PropuestaPagoCredito {
    const propClase = propuestas.find((p) => p.clase_prelacion === clase);
    const existente = propClase?.creditos.find((c) => c.acreedor_index === ac.__index);
    if (existente) return existente;
    const defaults = {
      acreedor_index: ac.__index,
      capital: ac.capital,
      tasa_interes_mensual_pct: ac.tasa_interes_mensual ?? 0,
      numero_cuotas: 12,
      meses_gracia: 0,
      tipo_amortizacion: "francesa" as TipoAmortizacion,
    };
    const cronograma = generarCronograma({
      capital: defaults.capital,
      tasaMensualPct: defaults.tasa_interes_mensual_pct,
      numeroCuotas: defaults.numero_cuotas,
      mesesGracia: defaults.meses_gracia,
      tipo: defaults.tipo_amortizacion,
    });
    const credito: PropuestaPagoCredito = {
      ...defaults,
      cronograma,
      redaccion_narrativa: generarRedaccionCredito(
        { ...defaults, cronograma },
        ac,
        clase,
      ),
    };
    return credito;
  }

  function actualizarCreditoClase14(
    clase: ClasePrelacion,
    ac: AcreedorConIndice,
    patch: Partial<Pick<PropuestaPagoCredito, "numero_cuotas" | "meses_gracia" | "tipo_amortizacion" | "redaccion_narrativa">>,
    recalcularCronograma = true,
  ) {
    const acreedoresClase = acreedoresPorClase.get(clase) ?? [];
    const propClase = propuestas.find((p) => p.clase_prelacion === clase) ?? {
      clase_prelacion: clase,
      creditos: [],
    };

    // Asegurar todos los créditos de la clase (sincronización con Paso 5)
    const creditosSync = acreedoresClase.map((a) => {
      if (a.__index === ac.__index) {
        const base = asegurarCreditoClase14(clase, a);
        const merged: PropuestaPagoCredito = { ...base, ...patch };
        if (recalcularCronograma) {
          merged.cronograma = generarCronograma({
            capital: a.capital,
            tasaMensualPct: a.tasa_interes_mensual ?? 0,
            numeroCuotas: merged.numero_cuotas,
            mesesGracia: merged.meses_gracia,
            tipo: merged.tipo_amortizacion,
          });
          merged.capital = a.capital;
          merged.tasa_interes_mensual_pct = a.tasa_interes_mensual ?? 0;
          // Regenerar narrativa solo si el usuario no la ha editado manualmente
          if (!patch.redaccion_narrativa) {
            merged.redaccion_narrativa = generarRedaccionCredito(merged, a, clase);
          }
        }
        return merged;
      }
      return asegurarCreditoClase14(clase, a);
    });

    reemplazarClase({ ...propClase, clase_prelacion: clase, creditos: creditosSync });
  }

  // ------------ Clase 5ª ------------

  function actualizarClase5(
    patch: Partial<Pick<
      PropuestaPagoClase,
      | "numero_cuotas_compartido"
      | "meses_gracia_compartido"
      | "tipo_amortizacion_compartido"
      | "prioridad_pequenos"
      | "m_cuotas_pequenos"
    >> & { narrativaOverrides?: Record<number, string> } = {},
  ) {
    const quintos = acreedoresPorClase.get("quinta") ?? [];
    const propActual = propuestas.find((p) => p.clase_prelacion === "quinta") ?? {
      clase_prelacion: "quinta" as const,
      numero_cuotas_compartido: 24,
      meses_gracia_compartido: 0,
      tipo_amortizacion_compartido: "francesa" as TipoAmortizacion,
      prioridad_pequenos: false,
      creditos: [],
    };
    const next: PropuestaPagoClase = {
      ...propActual,
      ...patch,
      clase_prelacion: "quinta",
    };

    const numeroCuotas = next.numero_cuotas_compartido ?? 24;
    const mesesGracia = next.meses_gracia_compartido ?? 0;
    const tipoAmort = next.tipo_amortizacion_compartido ?? "francesa";

    const entrada = quintos.map((a) => ({
      acreedor_index: a.__index,
      capital: a.capital,
      tasa_interes_mensual_pct: a.tasa_interes_mensual ?? 0,
    }));

    let resultados: ReturnType<typeof generarCronogramaProrrataQuinta>;

    if (next.prioridad_pequenos) {
      const m = Math.max(1, Math.min(numeroCuotas - 1, next.m_cuotas_pequenos ?? Math.floor(numeroCuotas / 2)));
      next.m_cuotas_pequenos = m;
      const marcados = calcularPequenosAcreedores(
        quintos.map((a) => ({ id: String(a.__index), capital: a.capital })),
      );
      const setPequenos = new Set(marcados.filter((m) => m.es_pequeno_acreedor).map((m) => m.id));
      const pequenos = entrada.filter((c) => setPequenos.has(String(c.acreedor_index)));
      const otros = entrada.filter((c) => !setPequenos.has(String(c.acreedor_index)));
      resultados = generarCronogramaPrioridadPequenos({
        pequenos,
        otros,
        numeroCuotasTotal: numeroCuotas,
        mCuotasPequenos: m,
        mesesGraciaCompartido: mesesGracia,
        tipoAmortizacion: tipoAmort,
      });
    } else {
      next.m_cuotas_pequenos = undefined;
      resultados = generarCronogramaProrrataQuinta({
        creditos: entrada,
        numeroCuotasCompartido: numeroCuotas,
        mesesGraciaCompartido: mesesGracia,
        tipoAmortizacion: tipoAmort,
      });
    }

    const narrativasExistentes = new Map(
      propActual.creditos.map((c) => [c.acreedor_index, c.redaccion_narrativa]),
    );
    const overrides = patch.narrativaOverrides ?? {};

    next.creditos = resultados.map((r) => {
      const ac = quintos.find((a) => a.__index === r.acreedor_index);
      const base: PropuestaPagoCredito = {
        acreedor_index: r.acreedor_index,
        capital: ac?.capital ?? 0,
        tasa_interes_mensual_pct: ac?.tasa_interes_mensual ?? 0,
        numero_cuotas: r.cronograma.length,
        meses_gracia: r.cronograma.length > 0 ? r.cronograma[0].mes_relativo - 1 : mesesGracia,
        tipo_amortizacion: tipoAmort,
        porcentaje_prorrata: r.porcentaje_prorrata,
        cronograma: r.cronograma,
        redaccion_narrativa: "",
      };
      const narrativaAuto = ac ? generarRedaccionCredito(base, ac, "quinta") : "";
      const override = overrides[r.acreedor_index];
      // Si el usuario editó manualmente antes y los parámetros no cambiaron, conservamos
      const anterior = narrativasExistentes.get(r.acreedor_index);
      base.redaccion_narrativa = override ?? anterior ?? narrativaAuto;
      return base;
    });

    reemplazarClase(next);
  }

  function actualizarNarrativaQuinta(acreedorIndex: number, narrativa: string) {
    const propActual = propuestas.find((p) => p.clase_prelacion === "quinta");
    if (!propActual) return;
    const creditos = propActual.creditos.map((c) =>
      c.acreedor_index === acreedorIndex ? { ...c, redaccion_narrativa: narrativa } : c,
    );
    reemplazarClase({ ...propActual, creditos });
  }

  // ------------ Render ------------

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="font-semibold text-lg">Propuesta de pago</h2>
        <p className="text-sm text-gray-600">
          Los pagos se realizarán mensualmente a partir del mes siguiente a la suscripción del acuerdo.
          Los cronogramas se expresan en meses relativos desde esa fecha.
        </p>
      </header>

      {clasesActivas.length === 0 && (
        <p className="text-sm text-gray-500">
          Agrega acreedores en el paso 5 (con su clase de prelación y tasa de interés) para armar la propuesta.
        </p>
      )}

      {acreedoresSinTasa.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Debes diligenciar la <b>tasa de interés mensual</b> en el Paso 5 para los siguientes acreedores
          antes de poder calcular su cronograma:
          <ul className="list-disc ml-5 mt-1">
            {acreedoresSinTasa.map((a) => (
              <li key={a.__index}>{a.nombre}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Condonaciones globales */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="font-medium mb-2">Condonaciones solicitadas (opcional)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Los conceptos marcados se incluirán en la narrativa como una petición al acreedor. No afectan el cálculo del cronograma.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Check
            label="Intereses corrientes"
            checked={condonaciones?.intereses_corrientes ?? false}
            onC={(v) => actualizarCondonaciones({ intereses_corrientes: v })}
          />
          <Check
            label="Intereses moratorios"
            checked={condonaciones?.intereses_moratorios ?? false}
            onC={(v) => actualizarCondonaciones({ intereses_moratorios: v })}
          />
          <Check
            label="Otros conceptos distintos al capital"
            checked={condonaciones?.otros_conceptos_distintos_capital ?? false}
            onC={(v) => actualizarCondonaciones({ otros_conceptos_distintos_capital: v })}
          />
        </div>
        <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">
          Detalle adicional (opcional)
        </label>
        <textarea
          rows={2}
          value={condonaciones?.detalle_adicional ?? ""}
          onChange={(e) => actualizarCondonaciones({ detalle_adicional: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Ej.: Se solicita también la condonación de honorarios de cobranza."
        />
        {(() => {
          const red = generarRedaccionCondonaciones(condonaciones);
          if (!red) return null;
          return (
            <p className="mt-3 text-xs italic text-gray-700 bg-gray-50 p-2 rounded">
              Vista previa: {red}
            </p>
          );
        })()}
      </div>

      {/* KPIs */}
      {clasesActivas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Capital pasivo total" value={fmt(kpis.capitalPasivo)} />
          <Kpi label="Total proyectado a pagar" value={fmt(kpis.totalAPagar)} />
          <Kpi label="Total intereses" value={fmt(kpis.totalIntereses)} />
          <Kpi label="Plazo máximo" value={`${kpis.plazoMaxMeses} meses`} />
        </div>
      )}

      {/* Clases 1ª a 4ª */}
      {clasesActivas.filter((c) => c !== "quinta").map((clase) => {
        const acs = acreedoresPorClase.get(clase) ?? [];
        return (
          <ClaseCard key={clase} titulo={CLASE_PRELACION_LABEL[clase]}>
            {acs.map((ac) => {
              const credito = asegurarCreditoClase14(clase, ac);
              const tasaEA = ac.tasa_interes_mensual
                ? (tasaMensualAEA(ac.tasa_interes_mensual) * 100).toFixed(2)
                : "—";
              return (
                <div key={ac.__index} className="border-t border-gray-200 pt-4 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{ac.nombre}</p>
                      <p className="text-xs text-gray-500">
                        Capital {fmt(ac.capital)} · Tasa {ac.tasa_interes_mensual ?? 0}% mensual ({tasaEA}% EA)
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Num
                      label="N° de cuotas"
                      val={credito.numero_cuotas}
                      onC={(v) => actualizarCreditoClase14(clase, ac, { numero_cuotas: Math.max(1, Math.floor(v)) })}
                    />
                    <Num
                      label="Meses de gracia"
                      val={credito.meses_gracia}
                      onC={(v) => actualizarCreditoClase14(clase, ac, { meses_gracia: Math.max(0, Math.floor(v)) })}
                    />
                    <Select
                      label="Tipo de amortización"
                      val={credito.tipo_amortizacion}
                      options={[
                        { v: "francesa", l: "Francesa (cuota fija)" },
                        { v: "lineal", l: "Lineal (capital constante)" },
                      ]}
                      onC={(v) => actualizarCreditoClase14(clase, ac, { tipo_amortizacion: v as TipoAmortizacion })}
                    />
                  </div>
                  <TablaCronograma cronograma={credito.cronograma} />
                  <NarrativaEditable
                    value={credito.redaccion_narrativa}
                    onC={(t) => actualizarCreditoClase14(clase, ac, { redaccion_narrativa: t }, false)}
                  />
                </div>
              );
            })}
          </ClaseCard>
        );
      })}

      {/* Clase 5ª */}
      {clasesActivas.includes("quinta") && (() => {
        const quintos = acreedoresPorClase.get("quinta") ?? [];
        const propQuinta = propuestas.find((p) => p.clase_prelacion === "quinta");
        const numeroCuotas = propQuinta?.numero_cuotas_compartido ?? 24;
        const mesesGracia = propQuinta?.meses_gracia_compartido ?? 0;
        const tipoAmort = propQuinta?.tipo_amortizacion_compartido ?? "francesa";
        const prioridad = propQuinta?.prioridad_pequenos ?? false;
        const m = propQuinta?.m_cuotas_pequenos ?? Math.floor(numeroCuotas / 2);

        // Inicializar si aún no existe
        if (!propQuinta) {
          actualizarClase5({});
        }

        const marcados = calcularPequenosAcreedores(
          quintos.map((a) => ({ id: String(a.__index), capital: a.capital })),
        );
        const setPequenos = new Set(marcados.filter((m) => m.es_pequeno_acreedor).map((m) => m.id));

        return (
          <ClaseCard titulo={CLASE_PRELACION_LABEL.quinta}>
            <p className="text-xs text-gray-600 -mt-2 mb-2">
              Todos los acreedores de quinta clase se pagan en el mismo plazo. La distribución se calcula a
              prorrata según el capital de cada crédito.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Num
                label="N° de cuotas (compartido)"
                val={numeroCuotas}
                onC={(v) => actualizarClase5({ numero_cuotas_compartido: Math.max(1, Math.floor(v)) })}
              />
              <Num
                label="Meses de gracia (compartido)"
                val={mesesGracia}
                onC={(v) => actualizarClase5({ meses_gracia_compartido: Math.max(0, Math.floor(v)) })}
              />
              <Select
                label="Tipo de amortización"
                val={tipoAmort}
                options={[
                  { v: "francesa", l: "Francesa (cuota fija)" },
                  { v: "lineal", l: "Lineal (capital constante)" },
                ]}
                onC={(v) => actualizarClase5({ tipo_amortizacion_compartido: v as TipoAmortizacion })}
              />
            </div>

            <div className="mt-3">
              <Check
                label="Priorizar pequeños acreedores (Art. 553 Ley 2445)"
                checked={prioridad}
                onC={(v) => actualizarClase5({ prioridad_pequenos: v })}
              />
              {prioridad && (
                <div className="mt-2 ml-6 grid grid-cols-2 gap-3 max-w-md">
                  <Num
                    label={`Cuotas al tramo pequeños (1..${numeroCuotas - 1})`}
                    val={m}
                    onC={(v) =>
                      actualizarClase5({
                        m_cuotas_pequenos: Math.max(1, Math.min(numeroCuotas - 1, Math.floor(v))),
                      })
                    }
                  />
                  <div className="text-xs text-gray-600 self-end pb-2">
                    Resto ({numeroCuotas - m} cuotas) al resto de 5ª clase.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {(propQuinta?.creditos ?? []).map((c) => {
                const ac = quintos.find((a) => a.__index === c.acreedor_index);
                if (!ac) return null;
                const esPequeno = setPequenos.has(String(ac.__index));
                return (
                  <div key={c.acreedor_index} className="border-t border-gray-200 pt-3 first:border-0 first:pt-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <div>
                        <p className="font-medium text-sm">
                          {ac.nombre}
                          {prioridad && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${esPequeno ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                              {esPequeno ? "Pequeño acreedor" : "Otros 5ª"}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Capital {fmt(ac.capital)} · Tasa {ac.tasa_interes_mensual ?? 0}% mensual
                          {c.porcentaje_prorrata != null && ` · Prorrata ${c.porcentaje_prorrata}%`}
                        </p>
                      </div>
                    </div>
                    <TablaCronograma cronograma={c.cronograma} />
                    <NarrativaEditable
                      value={c.redaccion_narrativa}
                      onC={(t) => actualizarNarrativaQuinta(c.acreedor_index, t)}
                    />
                  </div>
                );
              })}
            </div>
          </ClaseCard>
        );
      })()}
    </section>
  );
}

// ------------ Helpers de UI ------------

function ClaseCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="font-medium mb-3">{titulo}</h3>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}

function Num({ label, val, onC }: { label: string; val: number; onC: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        value={val}
        onChange={(e) => onC(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}

function Select({
  label, val, options, onC,
}: {
  label: string;
  val: string;
  options: { v: string; l: string }[];
  onC: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={val}
        onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function Check({ label, checked, onC }: { label: string; checked: boolean; onC: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onC(e.target.checked)}
        className="rounded"
      />
      {label}
    </label>
  );
}

function TablaCronograma({ cronograma }: { cronograma: { cuota: number; mes_relativo: number; cuota_total: number; intereses: number; amortizacion: number; saldo: number }[] }) {
  if (cronograma.length === 0) return null;
  const totales = cronograma.reduce(
    (acc, c) => ({
      intereses: acc.intereses + c.intereses,
      amortizacion: acc.amortizacion + c.amortizacion,
      total: acc.total + c.cuota_total,
    }),
    { intereses: 0, amortizacion: 0, total: 0 },
  );
  return (
    <details className="mt-3">
      <summary className="text-xs text-[#1B4F9B] cursor-pointer">
        Ver cronograma ({cronograma.length} cuotas · cuota {fmt(cronograma[0].cuota_total)})
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full mt-2 text-xs">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="text-left py-1">#</th>
              <th className="text-left">Mes</th>
              <th className="text-right">Cuota</th>
              <th className="text-right">Intereses</th>
              <th className="text-right">Amortización</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {cronograma.map((c) => (
              <tr key={c.cuota} className="border-b border-gray-100">
                <td className="py-0.5">{c.cuota}</td>
                <td>Mes {c.mes_relativo}</td>
                <td className="text-right">{fmt(c.cuota_total)}</td>
                <td className="text-right">{fmt(c.intereses)}</td>
                <td className="text-right">{fmt(c.amortizacion)}</td>
                <td className="text-right">{fmt(c.saldo)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td colSpan={2} className="pt-1">Totales</td>
              <td className="text-right">{fmt(totales.total)}</td>
              <td className="text-right">{fmt(totales.intereses)}</td>
              <td className="text-right">{fmt(totales.amortizacion)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

function NarrativaEditable({ value, onC }: { value: string; onC: (v: string) => void }) {
  return (
    <details className="mt-2">
      <summary className="text-xs text-[#1B4F9B] cursor-pointer">Redacción narrativa (editable)</summary>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onC(e.target.value)}
        className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-xs font-sans"
      />
    </details>
  );
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}
