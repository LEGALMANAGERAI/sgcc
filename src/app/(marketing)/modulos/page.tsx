import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface Modulo {
  titulo: string;
  nombre: string;
  planes: string;
  planColor: string;
  desc: string;
  features: string[];
  mockupKey: string;
}

const MODULOS: Modulo[] = [
  {
    titulo: "Casos y expedientes: todo el centro en un lugar",
    nombre: "Casos / Expedientes",
    planes: "Todos los planes",
    planColor: "#0D2340",
    desc:
      "El corazón de SIGECC. Cada solicitud que entra al centro abre un expediente con flujo guiado: conciliación, insolvencia o acuerdo de apoyo. Estado, partes, apoderados, documentos y audiencias en una sola vista, con historial completo de cambios.",
    features: [
      "Conciliación, insolvencia y acuerdos de apoyo en flujos separados",
      "Numeración con radicado configurable por centro",
      "Partes con búsqueda por documento (no por email)",
      "Vinculación automática con apoderados y poderes",
      "Historial completo de cambios y movimientos",
      "Buscador global de casos por número, parte o convocado",
    ],
    mockupKey: "casos",
  },
  {
    titulo: "Audiencias: programa, reprograma y registra",
    nombre: "Audiencias",
    planes: "Todos los planes",
    planColor: "#1B5FA8",
    desc:
      "Programación rápida desde el expediente, recordatorios automáticos a las partes, soporte para audiencias presenciales, virtuales o híbridas conforme al Decreto 1136/2025. Asistencia con tres estados (sí / no / sin marcar) y generación de acta directamente desde la pestaña de audiencia.",
    features: [
      "Modalidad presencial, virtual o híbrida",
      "Reprogramación con justificación y notificación",
      "Asistencia tres estados (sí / no / sin marcar)",
      "Generación de acta inline con plantilla del centro",
      "Cambio de apoderado durante la audiencia con historial",
      "Cumplimiento Decreto 1136/2025 — habilitación tecnológica",
    ],
    mockupKey: "audiencias",
  },
  {
    titulo: "Agenda: vista de cupos en tiempo real",
    nombre: "Agenda",
    planes: "Todos los planes",
    planColor: "#2A9D5C",
    desc:
      "Calendario por conciliador con sugerencia automática de cupos disponibles. Programa audiencias en segundos desde el calendario y crea un expediente exprés sin salir de la vista. Pendientes y compromisos visibles para coordinar al equipo.",
    features: [
      "Vista por conciliador o por sala",
      "Sugerencia automática del próximo cupo disponible",
      "Crear expediente exprés desde la agenda",
      "Pendientes y compromisos editables por audiencia",
      "Cancelación y reprogramación con auditoría",
      "Sincroniza con audiencias del expediente",
    ],
    mockupKey: "agenda",
  },
  {
    titulo: "Insolvencia: el módulo más completo del mercado",
    nombre: "Insolvencia (Ley 2445)",
    planes: "Desde Esencial",
    planColor: "#6B1D3A",
    desc:
      "Cumplimiento integral Ley 2445/2025 + Decreto 1136/2025 para insolvencia de Personas Naturales No Comerciantes. Acreencias con consolidación por NIT, propuestas de pago estructuradas, votación 1 acreedor = 1 voto, exportación de actas en Word/PDF con márgenes oficiales.",
    features: [
      "Wizard guiado Art. 539 — admisión PNNC",
      "Relación de acreencias con consolidación automática por documento",
      "Propuesta de pago estructurada (cuotas, tasa NMV/EA, modos)",
      "Pequeño acreedor calculado correctamente cuando capital es 0",
      "Votación 1 acreedor = 1 voto + acta de votación exportable",
      "Liquidación patrimonial post-audiencia",
      "PDF firmado del acuerdo antes de radicar",
    ],
    mockupKey: "insolvencia",
  },
  {
    titulo: "Apoderados y poderes con firma certificada",
    nombre: "Apoderados",
    planes: "Todos los planes",
    planColor: "#7c3aed",
    desc:
      "Carga y verificación de poderes con almacenamiento privado en Supabase, signed URLs con expiración de 24 horas, validación de existencia física del archivo. Crea apoderado, convocado y poder PDF desde una tarjeta modal sin salir del expediente.",
    features: [
      "Bucket privado con signed URLs (no expone enlaces públicos)",
      "Validación de existencia del archivo antes de generar URL",
      "Soporte de cargas hasta 4 MB con feedback en tiempo real",
      "Vincula apoderado a múltiples casos sin duplicar persona",
      "Cambio de apoderado durante audiencia registra historial",
      "Verificación cruzada con tabla apoderados-poder",
    ],
    mockupKey: "apoderados",
  },
  {
    titulo: "Portal de partes: el centro habla con los usuarios",
    nombre: "Portal de partes",
    planes: "Todos los planes",
    planColor: "#0D2340",
    desc:
      "Acceso seguro para convocantes y convocados al expediente, con widget embebible para tu sitio web. Las partes consultan estado, audiencias agendadas y documentos sin llamar al centro. Cumplimiento Ley 2445 — radicación virtual completa.",
    features: [
      "Widget embebible para tu sitio (script de 1 línea)",
      "Acceso por documento de identidad, no por email",
      "Vista de audiencias agendadas con modalidad y enlace",
      "Descarga de documentos firmados",
      "Sistema de tickets entre partes y staff con adjuntos",
      "Rate limit y validación anti-spam en endpoints públicos",
    ],
    mockupKey: "portal",
  },
  {
    titulo: "SICAAC integrado: reportes oficiales sin pegar datos",
    nombre: "SICAAC",
    planes: "Desde Esencial",
    planColor: "#1B5FA8",
    desc:
      "Registro paralelo de expedientes y registros manuales para SICAAC. Diseñado para exportar lo que el Ministerio de Justicia exige sin duplicar trabajo en su plataforma. Plantillas por centro y bibliotecas de cláusulas reutilizables.",
    features: [
      "Expedientes SICAAC con flujo dedicado",
      "Registros manuales para casos importados de antes",
      "Plantillas por centro para acuerdos y actas",
      "Biblioteca de cláusulas reutilizables",
      "Exportación compatible con cargues oficiales",
      "Trazabilidad de cambios para auditoría",
    ],
    mockupKey: "sicaac",
  },
  {
    titulo: "Plantillas y actas: documentos en segundos",
    nombre: "Plantillas y Actas",
    planes: "Todos los planes",
    planColor: "#d97706",
    desc:
      "Biblioteca de actas y plantillas con generación PDF y Word. Márgenes oficiales, fechas en horario Colombia (no UTC), variables que se llenan desde el expediente automáticamente. Cada centro puede subir sus propios archivos.",
    features: [
      "Plantillas globales del sistema + plantillas propias del centro",
      "Generación PDF y Word con un clic",
      "Variables del expediente llenadas automáticamente",
      "Fechas en horario Colombia con helper fecha-colombia",
      "Subida y descarga de archivos propios del centro",
      "Versionado de plantillas con histórico",
    ],
    mockupKey: "plantillas",
  },
  {
    titulo: "Reglamento interno digital",
    nombre: "Reglamento interno",
    planes: "Desde Profesional",
    planColor: "#1F7544",
    desc:
      "Documento del reglamento del centro versionado y disponible para todo el staff. Cambios con historial, exportable a PDF, integrado con el módulo SICAAC para reportar al Ministerio.",
    features: [
      "Editor enriquecido con secciones predefinidas",
      "Versiones con histórico y fecha de vigencia",
      "Exportación PDF con membrete del centro",
      "Acceso restringido por rol",
      "Plantilla base conforme a Ley 2220/2022",
    ],
    mockupKey: "reglamento",
  },
  {
    titulo: "Firma electrónica con plena validez legal",
    nombre: "Firma electrónica",
    planes: "Desde Profesional + add-on",
    planColor: "#B8860B",
    desc:
      "Integración con Legal Manager para firmar actas, acuerdos y poderes con plena validez legal conforme a Ley 527 de 1999. OTP por email o SMS, foto de identidad, QR de verificación pública para que cualquier tercero valide la autenticidad.",
    features: [
      "OTP de verificación por email o SMS",
      "Captura de foto de identidad en tiempo real",
      "Multi-firmantes en secuencia o simultáneo",
      "Certificado con QR de verificación pública",
      "Audit trail forense completo",
      "Cumple Ley 527/1999 y Decreto 2364/2012",
    ],
    mockupKey: "firma",
  },
  {
    titulo: "Tickets: soporte entre partes y staff",
    nombre: "Tickets",
    planes: "Todos los planes",
    planColor: "#0D2340",
    desc:
      "Sistema de tickets para que partes, apoderados y staff se comuniquen sobre cada caso. Adjuntos múltiples al crear el ticket, badge de origen (parte o staff), historial completo de mensajes.",
    features: [
      "Tickets desde el portal de partes",
      "Adjuntos múltiples al crear (paste, drag & drop, click)",
      "Badge de origen (parte vs. staff)",
      "Notificaciones por email al equipo",
      "Vinculación automática con el expediente",
      "Cierre con resolución y trazabilidad",
    ],
    mockupKey: "tickets",
  },
  {
    titulo: "Radicado configurable por centro",
    nombre: "Radicado",
    planes: "Todos los planes",
    planColor: "#1B4F9B",
    desc:
      "Cada centro define su propio formato de radicado: prefijo, separador, año, consecutivo. Sin colisiones gracias al uso de MAX + retry en lugar de COUNT. Resuelve el problema clásico de los huecos cuando un caso se cancela.",
    features: [
      "Formato configurable: prefijo, año, consecutivo",
      "Cero colisiones (MAX + retry sobre COUNT)",
      "Numeración separada por tipo de trámite",
      "Reaprovecha consecutivos solo si tú lo decides",
      "Histórico de cambios con auditoría",
    ],
    mockupKey: "radicado",
  },
];

/* ───── Mockups CSS simples por módulo ───── */

function MockupCasos() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
            Expediente
          </div>
          <div className="text-sm font-black text-[#0D2340]">CCN-2026-00084</div>
        </div>
        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          Activo
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#F8FAFC] rounded p-2">
          <div className="text-[9px] text-[#94A3B8] uppercase font-bold">Convocante</div>
          <div className="text-xs font-bold text-[#0D2340]">María L. Pérez</div>
        </div>
        <div className="bg-[#F8FAFC] rounded p-2">
          <div className="text-[9px] text-[#94A3B8] uppercase font-bold">Convocado</div>
          <div className="text-xs font-bold text-[#0D2340]">Juan A. Castro</div>
        </div>
      </div>
      <div className="space-y-1">
        {["Conciliación", "Apoderados (1)", "Documentos (4)", "Audiencias (2)", "Actas (1)"].map((t) => (
          <div key={t} className="flex justify-between items-center text-[11px] py-1 border-b border-[#F1F5F9]">
            <span className="text-[#475569]">{t}</span>
            <span className="text-[#B8860B] font-bold">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupAudiencias() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-2">Audiencia · 28 May 2026</div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
          Virtual
        </span>
        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">
          Confirmada
        </span>
        <span className="text-[10px] text-[#94A3B8]">10:30 AM</span>
      </div>
      <div className="text-xs text-[#94A3B8] font-bold uppercase tracking-wider mb-2">
        Asistencia
      </div>
      <div className="space-y-1">
        {[
          { n: "María L. Pérez", est: "Sí", c: "bg-green-100 text-green-700" },
          { n: "Juan A. Castro", est: "Sí", c: "bg-green-100 text-green-700" },
          { n: "Apoderado de Juan", est: "Sin marcar", c: "bg-gray-100 text-gray-700" },
        ].map((p) => (
          <div key={p.n} className="flex items-center justify-between text-[11px] py-1">
            <span className="text-[#475569]">{p.n}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.c}`}>{p.est}</span>
          </div>
        ))}
      </div>
      <button className="w-full mt-3 text-[11px] font-bold bg-[#0D2340] text-white py-2 rounded-lg">
        Generar acta
      </button>
    </div>
  );
}

function MockupAgenda() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs font-bold text-[#0D2340]">Semana 28 May - 3 Jun</div>
        <span className="text-[10px] text-[#94A3B8]">Dra. López</span>
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold text-[#94A3B8] mb-1">
        <span>L</span>
        <span>M</span>
        <span>X</span>
        <span>J</span>
        <span>V</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {[
          { d: 28, slots: 2 },
          { d: 29, slots: 1 },
          { d: 30, slots: 0 },
          { d: 31, slots: 3 },
          { d: 1, slots: 2 },
        ].map((d) => (
          <div
            key={d.d}
            className={`text-center text-[10px] font-bold py-2 rounded ${
              d.slots === 0
                ? "bg-red-100 text-red-700"
                : d.slots > 2
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <div>{d.d}</div>
            <div className="text-[8px] font-normal">{d.slots}/3</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-[#475569] bg-[#F8FAFC] rounded p-2">
        Próximo cupo sugerido: <strong>Vie 1 jun · 9:00 AM</strong>
      </div>
    </div>
  );
}

function MockupInsolvencia() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-2">Relación de acreencias · INS-00012</div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            <th className="text-left font-bold text-[#94A3B8] py-1">Acreedor</th>
            <th className="text-right font-bold text-[#94A3B8]">Capital</th>
            <th className="text-center font-bold text-[#94A3B8]">Voto</th>
          </tr>
        </thead>
        <tbody>
          {[
            { n: "Davivienda", c: "$ 12.500.000", v: "Sí" },
            { n: "Banco BBVA", c: "$ 8.200.000", v: "Sí" },
            { n: "Codensa", c: "$ 420.000", v: "Sí" },
            { n: "Falabella CMR", c: "$ 1.850.000", v: "No" },
          ].map((a) => (
            <tr key={a.n} className="border-b border-[#F1F5F9]">
              <td className="py-1 text-[#475569]">{a.n}</td>
              <td className="text-right font-bold text-[#0D2340]">{a.c}</td>
              <td className="text-center">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    a.v === "Sí" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {a.v}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="bg-green-50 rounded p-2">
          <div className="text-[9px] text-green-700 font-bold">Aprobaron</div>
          <div className="text-sm font-black text-green-700">75%</div>
        </div>
        <div className="bg-[#F8FAFC] rounded p-2">
          <div className="text-[9px] text-[#94A3B8] font-bold">Quorum</div>
          <div className="text-sm font-black text-[#0D2340]">Sí</div>
        </div>
      </div>
    </div>
  );
}

function MockupApoderados() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-3">Apoderado vinculado</div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D2340] to-[#1B4F9B] flex items-center justify-center text-white font-black text-xs">
          MR
        </div>
        <div>
          <div className="text-sm font-bold text-[#0D2340]">Dr. Miguel Rivera</div>
          <div className="text-[10px] text-[#94A3B8]">T.P. 234.567 · C.C. 1.234.567.890</div>
        </div>
      </div>
      <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold text-[#94A3B8] uppercase">Poder</span>
          <span className="text-[10px] font-bold text-green-700">Verificado</span>
        </div>
        <div className="text-xs font-bold text-[#0D2340]">poder-miguel-rivera.pdf</div>
        <div className="text-[10px] text-[#94A3B8] mt-1">Signed URL · vence en 23h 47m</div>
      </div>
      <button className="w-full mt-3 text-[11px] font-bold bg-[#B8860B] text-white py-2 rounded-lg">
        Descargar poder
      </button>
    </div>
  );
}

function MockupPortal() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="bg-[#0D2340] -mx-4 -mt-4 px-4 py-3 mb-3 rounded-t-2xl">
        <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
          Centro Equilibra · Portal
        </div>
        <div className="text-sm font-black text-white">Hola, María</div>
      </div>
      <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-2">Tus casos</div>
      {[
        { n: "CCN-00084", t: "Conciliación", e: "Audiencia 28/05", c: "bg-blue-100 text-blue-700" },
        { n: "INS-00012", t: "Insolvencia", e: "En votación", c: "bg-amber-100 text-amber-700" },
      ].map((c) => (
        <div
          key={c.n}
          className="flex justify-between items-center py-2 border-b border-[#F1F5F9]"
        >
          <div>
            <div className="text-xs font-bold text-[#0D2340]">{c.n}</div>
            <div className="text-[10px] text-[#94A3B8]">{c.t}</div>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${c.c}`}>{c.e}</span>
        </div>
      ))}
    </div>
  );
}

function MockupSicaac() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-[#0D2340]">SICAAC · Expedientes mes</div>
        <span className="text-[10px] font-bold bg-[#B8860B]/10 text-[#B8860B] px-2 py-0.5 rounded">
          May 2026
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#F8FAFC] rounded p-2 text-center">
          <div className="text-lg font-black text-[#0D2340]">27</div>
          <div className="text-[9px] text-[#94A3B8]">Conciliados</div>
        </div>
        <div className="bg-[#F8FAFC] rounded p-2 text-center">
          <div className="text-lg font-black text-[#0D2340]">12</div>
          <div className="text-[9px] text-[#94A3B8]">Insolvencia</div>
        </div>
        <div className="bg-[#F8FAFC] rounded p-2 text-center">
          <div className="text-lg font-black text-[#0D2340]">4</div>
          <div className="text-[9px] text-[#94A3B8]">Apoyo</div>
        </div>
      </div>
      <button className="w-full text-[11px] font-bold bg-[#0D2340] text-white py-2 rounded-lg">
        Exportar reporte oficial
      </button>
    </div>
  );
}

function MockupPlantillas() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-3">Plantillas del centro</div>
      {[
        { n: "Acta de conciliación.docx", t: "Sistema", c: "text-[#94A3B8]" },
        { n: "Acta de insolvencia.docx", t: "Sistema", c: "text-[#94A3B8]" },
        { n: "Acuerdo de pago - propio.docx", t: "Centro", c: "text-[#B8860B]" },
        { n: "Citación virtual - propio.pdf", t: "Centro", c: "text-[#B8860B]" },
      ].map((p) => (
        <div
          key={p.n}
          className="flex items-center gap-2 py-1.5 border-b border-[#F1F5F9] text-[11px]"
        >
          <span className="text-[#B8860B]">📄</span>
          <span className="flex-1 text-[#475569] truncate">{p.n}</span>
          <span className={`text-[9px] font-bold ${p.c}`}>{p.t}</span>
        </div>
      ))}
    </div>
  );
}

function MockupReglamento() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-[10px] font-bold text-[#94A3B8] uppercase mb-1">Versión 3 · vigente</div>
      <div className="text-sm font-black text-[#0D2340] mb-3">Reglamento interno</div>
      <div className="space-y-1 text-[10px]">
        {[
          "Cap. I — Naturaleza del centro",
          "Cap. II — Conciliadores habilitados",
          "Cap. III — Aranceles",
          "Cap. IV — Audiencias virtuales",
          "Cap. V — Reglas insolvencia PNNC",
        ].map((c) => (
          <div
            key={c}
            className="flex justify-between items-center py-1 border-b border-[#F1F5F9]"
          >
            <span className="text-[#475569]">{c}</span>
            <span className="text-[#B8860B] font-bold">›</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-green-700 bg-green-50 rounded p-2 font-bold">
        Cumple Ley 2220/2022
      </div>
    </div>
  );
}

function MockupFirma() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-3">Firmar acta de conciliación</div>
      <div className="space-y-2">
        {[
          { n: "Dra. López (Conciliadora)", st: "Firmado", c: "text-green-700" },
          { n: "María L. Pérez", st: "Firmado", c: "text-green-700" },
          { n: "Juan A. Castro", st: "OTP enviado", c: "text-amber-700" },
        ].map((f) => (
          <div
            key={f.n}
            className="flex items-center justify-between py-1.5 border-b border-[#F1F5F9]"
          >
            <span className="text-[11px] text-[#475569]">{f.n}</span>
            <span className={`text-[10px] font-bold ${f.c}`}>{f.st}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-[#F8FAFC] rounded p-2 text-center">
        <div className="text-[10px] text-[#94A3B8]">QR verificación</div>
        <div className="text-[10px] font-bold text-[#0D2340]">qr.sigecc.co/v/ABCD1234</div>
      </div>
    </div>
  );
}

function MockupTickets() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-3">Ticket #209A34</div>
      <div className="text-[10px] text-[#94A3B8] mb-2">Caso CCN-00084 · Reprogramación</div>
      <div className="space-y-2">
        <div className="bg-[#F8FAFC] rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 rounded">
              Parte
            </span>
            <span className="text-[9px] text-[#94A3B8]">hace 2 h</span>
          </div>
          <div className="text-[11px] text-[#475569]">
            Solicito reprogramar audiencia del 28/05.
          </div>
        </div>
        <div className="bg-[#0D2340]/5 rounded-lg p-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold bg-[#B8860B]/10 text-[#B8860B] px-2 rounded">
              Staff
            </span>
            <span className="text-[9px] text-[#94A3B8]">hace 1 h</span>
          </div>
          <div className="text-[11px] text-[#475569]">
            Reprogramada al 31/05 · 10:30 AM. Adjunto nueva citación.
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupRadicado() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
      <div className="text-xs font-bold text-[#0D2340] mb-3">Formato de radicado</div>
      <div className="bg-[#F8FAFC] rounded-lg p-3 border-2 border-dashed border-[#B8860B]/30 mb-3">
        <div className="text-center text-2xl font-black text-[#0D2340] tracking-wider font-mono">
          CCN-2026-00084
        </div>
      </div>
      <div className="space-y-1.5 text-[11px]">
        {[
          { k: "Prefijo", v: "CCN" },
          { k: "Año", v: "2026" },
          { k: "Consecutivo", v: "5 dígitos" },
          { k: "Separador", v: "guion (-)" },
        ].map((c) => (
          <div key={c.k} className="flex justify-between py-1 border-b border-[#F1F5F9]">
            <span className="text-[#94A3B8]">{c.k}</span>
            <span className="font-bold text-[#0D2340]">{c.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCKUPS: Record<string, () => React.ReactElement> = {
  casos: MockupCasos,
  audiencias: MockupAudiencias,
  agenda: MockupAgenda,
  insolvencia: MockupInsolvencia,
  apoderados: MockupApoderados,
  portal: MockupPortal,
  sicaac: MockupSicaac,
  plantillas: MockupPlantillas,
  reglamento: MockupReglamento,
  firma: MockupFirma,
  tickets: MockupTickets,
  radicado: MockupRadicado,
};

export const metadata = {
  title: "Módulos — SIGECC",
  description:
    "Conoce todos los módulos de SIGECC: casos, audiencias, insolvencia Ley 2445, portal de partes, SICAAC, firma electrónica y más.",
};

export default function ModulosPage() {
  return (
    <main className="bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-[#B8860B] uppercase tracking-widest mb-3">
            Plataforma
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#0D2340] mb-4">
            Módulos y funcionalidades
          </h1>
          <p className="text-base sm:text-lg text-[#64748B] max-w-2xl mx-auto">
            Cada módulo está diseñado específicamente para centros de conciliación, notarías y
            consultorios jurídicos en Colombia.
          </p>
        </div>

        {/* Lista alternada */}
        <div className="space-y-20">
          {MODULOS.map((m, i) => {
            const Mockup = MOCKUPS[m.mockupKey];
            const isLeft = i % 2 === 0;

            return (
              <div
                key={m.nombre}
                className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center"
              >
                {/* Texto */}
                <div className={isLeft ? "lg:order-1" : "lg:order-2"}>
                  <span
                    className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3"
                    style={{ backgroundColor: `${m.planColor}15`, color: m.planColor }}
                  >
                    {m.planes}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#0D2340] mb-3 leading-tight">
                    {m.titulo}
                  </h2>
                  <p className="text-sm text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                    {m.nombre}
                  </p>
                  <p className="text-base text-[#475569] leading-relaxed mb-6">{m.desc}</p>
                  <ul className="space-y-2.5">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-[#B8860B] flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-[#475569]">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mockup */}
                <div className={isLeft ? "lg:order-2" : "lg:order-1"}>
                  <div className="relative">
                    <div
                      className="absolute -inset-4 rounded-3xl opacity-10 blur-2xl"
                      style={{ backgroundColor: m.planColor }}
                    />
                    <div className="relative">
                      {Mockup ? <Mockup /> : <div className="h-64 bg-white rounded-2xl border border-[#E2E8F0]" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Final */}
        <div className="mt-24 text-center bg-gradient-to-r from-[#0D2340] to-[#1B4F9B] rounded-3xl p-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
            ¿Listo para ver SIGECC en acción?
          </h2>
          <p className="text-white/70 text-base mb-8 max-w-2xl mx-auto">
            Empieza gratis con el plan Académico o prueba 15 días sin tarjeta cualquier plan pago.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link
              href="/registro"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-[#0D2340] bg-gradient-to-r from-[#B8860B] to-[#D4A017] px-7 py-3.5 rounded-full hover:from-[#9A7209] hover:to-[#B8860B] transition-all duration-300 shadow-lg shadow-[#B8860B]/25"
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/precios"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
            >
              Ver planes y precios
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
