"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PropuestaPagoEditor } from "@/components/propuesta-pago/PropuestaPagoEditor";
import { totalesDeCronograma } from "@/lib/solicitudes/payment-plan";
import type {
  AcreedorFormData,
  CondonacionesConfig,
  PropuestaPagoClase,
} from "@/types/solicitudes";

interface AcreedorCaso {
  id: string;
  nombre: string;
  tipo_doc?: string;
  numero_doc?: string;
  clase_prelacion?: string;
  capital: number;
  intereses?: number;
  mas_90_dias_mora?: boolean;
  tasa_interes_mensual?: number;
  tipo_credito?: string;
}

interface SnapshotData {
  acreedores?: AcreedorFormData[];
  propuesta_pago?: PropuestaPagoClase[];
  condonaciones_globales?: CondonacionesConfig;
}

interface VersionRow {
  version: number;
  estado: "borrador" | "presentada" | "sustituida" | "aceptada" | "archivada";
  motivo_ajuste: string | null;
  presentada_at: string | null;
  updated_at: string;
  created_at: string;
  snapshot_json: SnapshotData | null;
}

interface ApiResponse {
  caso: { id: string; estado: string; editable: boolean };
  acreedores: AcreedorCaso[];
  versiones: VersionRow[];
}

function acreedorCasoAForm(a: AcreedorCaso): AcreedorFormData {
  return {
    nombre: a.nombre,
    tipo_doc: a.tipo_doc,
    numero_doc: a.numero_doc,
    tipo_credito: a.tipo_credito,
    clase_prelacion:
      a.clase_prelacion && ["primera", "segunda", "tercera", "cuarta", "quinta"].includes(a.clase_prelacion)
        ? (a.clase_prelacion as AcreedorFormData["clase_prelacion"])
        : undefined,
    capital: a.capital,
    intereses: a.intereses ?? 0,
    mas_90_dias_mora: a.mas_90_dias_mora ?? false,
    tasa_interes_mensual: a.tasa_interes_mensual,
  };
}

function calcularTotalesVersion(v: VersionRow) {
  const propuesta = v.snapshot_json?.propuesta_pago ?? [];
  let total = 0;
  let intereses = 0;
  let plazo = 0;
  for (const clase of propuesta) {
    for (const cred of clase.creditos ?? []) {
      const t = totalesDeCronograma(cred.cronograma ?? []);
      total += t.total;
      intereses += t.intereses;
      const ultimoMes = cred.cronograma?.[cred.cronograma.length - 1]?.mes_relativo ?? 0;
      if (ultimoMes > plazo) plazo = ultimoMes;
    }
  }
  return { total, intereses, plazo };
}

function fmtCOP(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function PropuestaPagoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recargar = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/partes/casos/${id}/propuesta-pago`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Error cargando propuestas");
      return;
    }
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="text-sm text-gray-500">Cargando…</div>;
  }

  const vigente = data.versiones.find((v) => v.estado === "presentada");
  const borrador = data.versiones.find((v) => v.estado === "borrador");
  const historicas = data.versiones.filter(
    (v) => v.estado !== "borrador" && v.estado !== "presentada",
  );

  async function crearNuevaVersion() {
    setBusy(true);
    try {
      const motivo = window.prompt(
        "Describe brevemente el motivo del ajuste (será enviado al conciliador):",
        "",
      );
      const res = await fetch(`/api/partes/casos/${id}/propuesta-pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo_ajuste: motivo ?? "" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "No se pudo crear el borrador");
      } else {
        await recargar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function descartarBorrador(version: number) {
    if (!confirm(`¿Descartar el borrador de la versión ${version}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/partes/casos/${id}/propuesta-pago/${version}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "No se pudo descartar");
      } else {
        await recargar();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">
            <Link className="text-[#1B4F9B]" href={`/mis-casos/${id}`}>← Volver al caso</Link>
          </div>
          <h1 className="text-xl font-semibold mt-1">Propuesta de pago</h1>
          <p className="text-sm text-gray-600">
            Estado del caso: <b>{data.caso.estado}</b>
            {!data.caso.editable && (
              <span className="ml-2 text-amber-600">
                (no editable en este estado)
              </span>
            )}
          </p>
        </div>
        {data.caso.editable && !borrador && vigente && (
          <button
            className="rounded-lg bg-[#1B4F9B] text-white text-sm px-3 py-2 disabled:opacity-50"
            onClick={crearNuevaVersion}
            disabled={busy}
          >
            + Nueva versión de la propuesta
          </button>
        )}
      </header>

      {!vigente && !borrador && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          El caso aún no tiene una propuesta de pago registrada.
        </div>
      )}

      {borrador && (
        <BorradorEditor
          caseId={id}
          borrador={borrador}
          vigente={vigente}
          acreedoresCaso={data.acreedores}
          editable={data.caso.editable}
          onRefresh={recargar}
          onDescartar={() => descartarBorrador(borrador.version)}
        />
      )}

      {vigente && (
        <VersionCard
          titulo={`Versión vigente (v${vigente.version})`}
          version={vigente}
          acreedoresCaso={data.acreedores}
          destacar
        />
      )}

      {historicas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Historial</h2>
          <div className="space-y-3">
            {historicas.map((h) => (
              <VersionCard
                key={h.version}
                titulo={`Versión ${h.version} — ${h.estado}`}
                version={h}
                acreedoresCaso={data.acreedores}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ------------ Editor de borrador con comparador ------------

function BorradorEditor({
  caseId,
  borrador,
  vigente,
  acreedoresCaso,
  editable,
  onRefresh,
  onDescartar,
}: {
  caseId: string;
  borrador: VersionRow;
  vigente?: VersionRow;
  acreedoresCaso: AcreedorCaso[];
  editable: boolean;
  onRefresh: () => Promise<void>;
  onDescartar: () => Promise<void> | void;
}) {
  const acreedoresForm = useMemo(
    () =>
      borrador.snapshot_json?.acreedores ??
      acreedoresCaso.map(acreedorCasoAForm),
    [borrador.snapshot_json, acreedoresCaso],
  );

  const [propuestaPago, setPropuestaPago] = useState<PropuestaPagoClase[]>(
    borrador.snapshot_json?.propuesta_pago ?? [],
  );
  const [condonaciones, setCondonaciones] = useState<CondonacionesConfig | undefined>(
    borrador.snapshot_json?.condonaciones_globales,
  );
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const guardar = useCallback(async () => {
    setSaving(true);
    try {
      const snapshot: SnapshotData = {
        acreedores: acreedoresForm,
        propuesta_pago: propuestaPago,
        condonaciones_globales: condonaciones,
      };
      const res = await fetch(
        `/api/partes/casos/${caseId}/propuesta-pago/${borrador.version}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot_json: snapshot }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Error guardando");
      } else {
        setLastSaved(new Date().toLocaleTimeString("es-CO"));
      }
    } finally {
      setSaving(false);
    }
  }, [acreedoresForm, borrador.version, caseId, condonaciones, propuestaPago]);

  async function presentar() {
    if (!confirm(`¿Presentar la versión ${borrador.version}? La versión vigente será sustituida y el conciliador será notificado.`)) return;
    await guardar();
    const res = await fetch(
      `/api/partes/casos/${caseId}/propuesta-pago/${borrador.version}/presentar`,
      { method: "POST" },
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Error al presentar");
      return;
    }
    alert(`Versión ${borrador.version} presentada.`);
    await onRefresh();
  }

  return (
    <section className="rounded-lg border-2 border-emerald-300 bg-emerald-50/30 p-4 space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold">Borrador en edición — v{borrador.version}</h2>
          {borrador.motivo_ajuste && (
            <p className="text-xs text-gray-600 mt-1">
              Motivo del ajuste: <i>{borrador.motivo_ajuste}</i>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs text-red-700 hover:underline"
            onClick={onDescartar}
            disabled={!editable}
          >
            Descartar
          </button>
          <button
            className="rounded bg-white border border-gray-300 text-sm px-3 py-1.5 disabled:opacity-50"
            onClick={guardar}
            disabled={saving || !editable}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            className="rounded bg-[#1B4F9B] text-white text-sm px-3 py-1.5 disabled:opacity-50"
            onClick={presentar}
            disabled={saving || !editable}
          >
            Presentar al centro
          </button>
        </div>
      </header>
      {lastSaved && <p className="text-xs text-gray-500">Guardado {lastSaved}</p>}

      {vigente && (
        <Comparador borrador={{ propuestaPago, condonaciones }} vigente={vigente} />
      )}

      <PropuestaPagoEditor
        acreedores={acreedoresForm}
        propuestaPago={propuestaPago}
        condonacionesGlobales={condonaciones}
        readOnly={!editable}
        onChange={(patch) => {
          if (patch.propuesta_pago !== undefined) setPropuestaPago(patch.propuesta_pago);
          if (patch.condonaciones_globales !== undefined)
            setCondonaciones(patch.condonaciones_globales);
        }}
      />
    </section>
  );
}

// ------------ Card de versión (read-only) ------------

function VersionCard({
  titulo,
  version,
  acreedoresCaso,
  destacar,
}: {
  titulo: string;
  version: VersionRow;
  acreedoresCaso: AcreedorCaso[];
  destacar?: boolean;
}) {
  const [expandido, setExpandido] = useState(Boolean(destacar));
  const totales = calcularTotalesVersion(version);
  const acreedoresForm =
    version.snapshot_json?.acreedores ?? acreedoresCaso.map(acreedorCasoAForm);

  return (
    <div
      className={`rounded-lg border p-4 ${
        destacar ? "border-[#1B4F9B] bg-white" : "border-gray-200 bg-gray-50"
      }`}
    >
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{titulo}</h3>
          <p className="text-xs text-gray-600">
            {version.presentada_at
              ? `Presentada ${fmtFecha(version.presentada_at)}`
              : `Creada ${fmtFecha(version.created_at)}`}
            {version.motivo_ajuste && <> · {version.motivo_ajuste}</>}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Total a pagar {fmtCOP(totales.total)} · Intereses {fmtCOP(totales.intereses)} · Plazo {totales.plazo} meses
          </p>
        </div>
        <button
          className="text-xs text-[#1B4F9B]"
          onClick={() => setExpandido((v) => !v)}
        >
          {expandido ? "Ocultar detalle" : "Ver detalle"}
        </button>
      </header>

      {expandido && (
        <div className="mt-4">
          <PropuestaPagoEditor
            acreedores={acreedoresForm}
            propuestaPago={version.snapshot_json?.propuesta_pago ?? []}
            condonacionesGlobales={version.snapshot_json?.condonaciones_globales}
            readOnly
            onChange={() => {}}
          />
        </div>
      )}
    </div>
  );
}

// ------------ Comparador diff ------------

function Comparador({
  borrador,
  vigente,
}: {
  borrador: {
    propuestaPago: PropuestaPagoClase[];
    condonaciones?: CondonacionesConfig;
  };
  vigente: VersionRow;
}) {
  const totalesBorrador = useMemo(() => {
    let total = 0;
    let intereses = 0;
    let plazo = 0;
    for (const clase of borrador.propuestaPago) {
      for (const c of clase.creditos ?? []) {
        const t = totalesDeCronograma(c.cronograma ?? []);
        total += t.total;
        intereses += t.intereses;
        const last = c.cronograma?.[c.cronograma.length - 1]?.mes_relativo ?? 0;
        if (last > plazo) plazo = last;
      }
    }
    return { total, intereses, plazo };
  }, [borrador.propuestaPago]);

  const totalesVigente = calcularTotalesVersion(vigente);

  const rows: Array<{ label: string; v1: string; v2: string; delta: string }> = [
    {
      label: "Total a pagar",
      v1: fmtCOP(totalesVigente.total),
      v2: fmtCOP(totalesBorrador.total),
      delta: fmtCOP(totalesBorrador.total - totalesVigente.total),
    },
    {
      label: "Intereses",
      v1: fmtCOP(totalesVigente.intereses),
      v2: fmtCOP(totalesBorrador.intereses),
      delta: fmtCOP(totalesBorrador.intereses - totalesVigente.intereses),
    },
    {
      label: "Plazo máximo (meses)",
      v1: String(totalesVigente.plazo),
      v2: String(totalesBorrador.plazo),
      delta: String(totalesBorrador.plazo - totalesVigente.plazo),
    },
  ];

  return (
    <details className="rounded-lg border border-gray-200 bg-white p-3" open>
      <summary className="text-sm font-medium cursor-pointer">
        Comparación vs versión vigente (v{vigente.version})
      </summary>
      <table className="w-full mt-2 text-xs">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1">Métrica</th>
            <th className="text-right">Vigente</th>
            <th className="text-right">Borrador</th>
            <th className="text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100">
              <td className="py-1">{r.label}</td>
              <td className="text-right">{r.v1}</td>
              <td className="text-right font-medium">{r.v2}</td>
              <td className="text-right text-[#1B4F9B]">{r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
