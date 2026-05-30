import Link from "next/link";

export const metadata = {
  title: "Acuerdo de Nivel de Servicios — SIGECC",
  description: "SLA de SIGECC basado en proveedores de infraestructura vigentes.",
};

const FECHA_VIGENCIA = "29 de mayo de 2026";
const VERSION = "v1.0";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-xl font-black text-[#0D2340] mb-4 pb-2 border-b-2 border-[#B8860B]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
      {label}
    </span>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#3D5068] leading-relaxed mb-3">{children}</p>;
}

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* Header */}
      <header className="bg-[#0D2340] text-white py-10 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase mb-1">
            Documento Legal
          </div>
          <div className="text-3xl font-black mb-1">
            SIGECC<span className="text-[#B8860B]">.</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-3 mb-2">
            Acuerdo de Nivel de Servicios (SLA)
          </h1>
          <p className="text-white/70 text-sm max-w-2xl">
            Compromisos de disponibilidad, rendimiento y soporte de SIGECC, plataforma SaaS para
            centros de conciliación, insolvencia y acuerdos de apoyo en Colombia.
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/50">
            <span>
              Versión: <strong className="text-white/80">{VERSION}</strong>
            </span>
            <span>
              Vigente desde: <strong className="text-white/80">{FECHA_VIGENCIA}</strong>
            </span>
            <span>Revisión anual o ante cambio de proveedor</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Índice */}
        <nav className="bg-white rounded-2xl border border-[#DDE4ED] p-6 mb-10 shadow-sm">
          <h2 className="text-sm font-black text-[#0D2340] uppercase tracking-widest mb-4">
            Tabla de contenido
          </h2>
          <ol className="grid sm:grid-cols-2 gap-1 text-sm text-[#3D5068]">
            {[
              ["#alcance", "1. Alcance y partes"],
              ["#proveedores", "2. Proveedores de infraestructura"],
              ["#disponibilidad", "3. Disponibilidad comprometida"],
              ["#rendimiento", "4. Rendimiento y tiempos de respuesta"],
              ["#incidentes", "5. Clasificación de incidentes"],
              ["#mantenimiento", "6. Ventanas de mantenimiento"],
              ["#soporte", "7. Soporte y canales de atención"],
              ["#creditos", "8. Créditos por incumplimiento"],
              ["#exclusiones", "9. Exclusiones"],
              ["#obligaciones", "10. Obligaciones del cliente"],
              ["#seguridad", "11. Seguridad y datos"],
              ["#vigencia", "12. Vigencia y modificaciones"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="hover:text-[#0D2340] hover:underline transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* 1. Alcance */}
        <Section id="alcance" title="1. Alcance y partes">
          <P>
            Este Acuerdo de Nivel de Servicios (<strong>SLA</strong>) aplica entre{" "}
            <strong>SIGECC</strong> (en adelante "el Proveedor") y cualquier centro de conciliación,
            notaría, consultorio jurídico universitario, cámara de comercio o entidad que contrate los
            servicios de la plataforma SIGECC (en adelante "el Cliente").
          </P>
          <P>
            El presente documento establece los niveles mínimos de disponibilidad, rendimiento y
            soporte que el Proveedor se compromete a mantener, así como los mecanismos de
            compensación en caso de incumplimiento.
          </P>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Nota:</strong> Los compromisos del Proveedor están condicionados por los SLA de
            los proveedores de infraestructura terceros (Vercel, Supabase, Resend), cuyas garantías
            se detallan en la sección 2.
          </div>
        </Section>

        {/* 2. Proveedores */}
        <Section id="proveedores" title="2. Proveedores de infraestructura vigentes">
          <P>
            SIGECC opera sobre la siguiente infraestructura en la nube. Los SLA indicados corresponden
            a los acuerdos publicados por cada proveedor a la fecha de vigencia.
          </P>

          <div className="grid gap-4">
            <div className="bg-white rounded-xl border border-[#DDE4ED] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-[#0D2340] text-base">Vercel</h3>
                    <Chip label="Hosting & CDN" color="bg-blue-50 text-blue-700" />
                  </div>
                  <p className="text-sm text-[#3D5068] mb-3">
                    Plataforma de despliegue y entrega del frontend y API Routes de Next.js.
                    Proporciona red de distribución global (CDN), certificados SSL automáticos y
                    despliegues zero-downtime.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Plan: Pro</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Región primaria: us-east-1</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Edge global</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">SOC 2 Type II</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-green-600">99.99%</div>
                  <div className="text-xs text-[#7A8FA6]">SLA publicado</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DDE4ED] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-[#0D2340] text-base">Supabase</h3>
                    <Chip label="Base de datos & Storage" color="bg-green-50 text-green-700" />
                  </div>
                  <p className="text-sm text-[#3D5068] mb-3">
                    Base de datos PostgreSQL gestionada, almacenamiento privado de archivos (Storage)
                    y autenticación. Todos los expedientes, audiencias, documentos y registros de
                    SIGECC residen en Supabase. Región:{" "}
                    <strong>sa-east-1 (São Paulo)</strong> para optimizar latencia en Colombia.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Plan: Pro</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Región: sa-east-1</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Backups diarios</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Retención 7 días</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">SOC 2 Type II</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-green-600">99.9%</div>
                  <div className="text-xs text-[#7A8FA6]">SLA publicado</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DDE4ED] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-[#0D2340] text-base">Resend</h3>
                    <Chip label="Correos transaccionales" color="bg-orange-50 text-orange-700" />
                  </div>
                  <p className="text-sm text-[#3D5068] mb-3">
                    Envío de correos transaccionales: notificaciones de audiencias, recordatorios de
                    términos legales, invitaciones de staff. Dominio remitente:{" "}
                    <strong>noreply@sigecc.co</strong>.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">Plan: Pro</span>
                    <span className="bg-[#F4F6F9] px-2 py-1 rounded">DKIM/SPF configurado</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-black text-green-600">99.9%</div>
                  <div className="text-xs text-[#7A8FA6]">SLA publicado</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 3. Disponibilidad */}
        <Section id="disponibilidad" title="3. Disponibilidad comprometida por SIGECC">
          <P>
            La disponibilidad efectiva de SIGECC se calcula como el producto de las disponibilidades
            de sus componentes críticos (Vercel × Supabase). El compromiso del Proveedor es:
          </P>

          <div className="bg-white rounded-xl border border-[#DDE4ED] overflow-hidden shadow-sm mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="text-left px-4 py-3 font-bold">Componente</th>
                  <th className="text-center px-4 py-3 font-bold">Disponibilidad</th>
                  <th className="text-center px-4 py-3 font-bold">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Plataforma web (Vercel)", "99.99%", "Total"],
                  ["Base de datos (Supabase)", "99.9%", "Total"],
                  ["Correos (Resend)", "99.9%", "Solo notificaciones"],
                  ["SIGECC — Compromiso total", "99.5%", "—"],
                ].map(([comp, sla, imp], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[#F4F6F9]" : "bg-white"}>
                    <td
                      className={`px-4 py-3 ${i === 3 ? "font-black text-[#0D2340]" : "text-[#3D5068]"}`}
                    >
                      {comp}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-bold ${i === 3 ? "text-[#B8860B] text-base" : "text-green-700"}`}
                    >
                      {sla}
                    </td>
                    <td className="px-4 py-3 text-center text-[#7A8FA6] text-xs">{imp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: "Disponibilidad mínima mensual", value: "99.5%", sub: "≤ 3.6 h caída/mes" },
              { label: "RTO incidente crítico", value: "4 h", sub: "Tiempo de recuperación" },
              { label: "RPO backups", value: "24 h", sub: "Punto de recuperación" },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-xl border border-[#DDE4ED] p-5 text-center"
              >
                <div className="text-2xl font-black text-[#0D2340] mb-1">{item.value}</div>
                <div className="text-xs font-bold text-[#3D5068] mb-1">{item.label}</div>
                <div className="text-xs text-[#7A8FA6]">{item.sub}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Rendimiento */}
        <Section id="rendimiento" title="4. Rendimiento y tiempos de respuesta">
          <div className="bg-white rounded-xl border border-[#DDE4ED] overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="text-left px-4 py-3 font-bold">Métrica</th>
                  <th className="text-center px-4 py-3 font-bold">Objetivo</th>
                  <th className="text-left px-4 py-3 font-bold">Condición</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Carga inicial (TTFB)", "< 800 ms", "Red 10 Mbps, Colombia"],
                  ["Renderizado módulo (LCP)", "< 3 seg", "Dispositivo gama media"],
                  ["API CRUD estándar", "< 500 ms", "Consultas < 1,000 registros"],
                  ["Generación PDF acta", "< 5 seg", "Plantilla estándar"],
                  ["Carga/descarga documentos", "< 10 seg", "Hasta 10 MB"],
                  ["Signed URL poderes", "< 2 seg", "Bucket privado"],
                ].map(([metrica, objetivo, cond], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[#F4F6F9]" : "bg-white"}>
                    <td className="px-4 py-3 text-[#3D5068]">{metrica}</td>
                    <td className="px-4 py-3 text-center font-bold text-[#0D2340]">{objetivo}</td>
                    <td className="px-4 py-3 text-[#7A8FA6] text-xs">{cond}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 5. Incidentes */}
        <Section id="incidentes" title="5. Clasificación y tiempos de atención">
          <div className="grid gap-3">
            {[
              {
                nivel: "P1 — Crítico",
                color: "border-red-400 bg-red-50",
                badge: "bg-red-100 text-red-700",
                descripcion:
                  "Plataforma completamente inaccesible o pérdida total de datos del centro.",
                respuesta: "2 horas",
                resolucion: "8 horas",
                ejemplos:
                  "Caída total del sistema, imposibilidad de login, pérdida de expedientes",
              },
              {
                nivel: "P2 — Alto",
                color: "border-orange-400 bg-orange-50",
                badge: "bg-orange-100 text-orange-700",
                descripcion: "Funcionalidad principal no disponible sin alternativa inmediata.",
                respuesta: "4 horas",
                resolucion: "24 horas",
                ejemplos:
                  "Módulo de insolvencia no carga, generación de actas falla sistemáticamente",
              },
              {
                nivel: "P3 — Medio",
                color: "border-yellow-400 bg-yellow-50",
                badge: "bg-yellow-100 text-yellow-700",
                descripcion: "Funcionalidad secundaria afectada o degradación de rendimiento.",
                respuesta: "8 horas",
                resolucion: "48 horas",
                ejemplos:
                  "Descarga de poderes lenta, exportación SICAAC intermitente",
              },
              {
                nivel: "P4 — Bajo",
                color: "border-blue-300 bg-blue-50",
                badge: "bg-blue-100 text-blue-700",
                descripcion: "Inconvenientes menores, errores de interfaz o solicitudes de mejora.",
                respuesta: "24 horas",
                resolucion: "72 horas",
                ejemplos: "Error tipográfico, solicitud de nueva funcionalidad, consulta general",
              },
            ].map((inc) => (
              <div key={inc.nivel} className={`rounded-xl border-l-4 p-5 ${inc.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${inc.badge}`}>
                    {inc.nivel}
                  </span>
                </div>
                <p className="text-sm text-[#3D5068] mb-3">{inc.descripcion}</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>
                    <strong>Respuesta inicial:</strong> {inc.respuesta}
                  </span>
                  <span>
                    <strong>Resolución objetivo:</strong> {inc.resolucion}
                  </span>
                  <span className="text-[#7A8FA6]">
                    <em>Ej: {inc.ejemplos}</em>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#7A8FA6] mt-3">
            * Tiempos en horas hábiles (L–V 8:00–18:00 COT), excepto P1 que aplica 24/7.
          </p>
        </Section>

        {/* 6. Mantenimiento */}
        <Section id="mantenimiento" title="6. Ventanas de mantenimiento programado">
          <div className="bg-white rounded-xl border border-[#DDE4ED] p-6 shadow-sm">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-[#0D2340] mb-2">Mantenimiento planificado</h3>
                <ul className="text-sm text-[#3D5068] space-y-1">
                  <li>
                    Ventana: <strong>Domingos 2:00 – 4:00 AM (COT)</strong>
                  </li>
                  <li>
                    Notificación previa: <strong>48 horas</strong>
                  </li>
                  <li>Canal: correo registrado en la plataforma</li>
                  <li>
                    Duración máxima: <strong>2 horas</strong>
                  </li>
                  <li>Frecuencia: máximo una vez por semana</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-[#0D2340] mb-2">Mantenimiento de emergencia</h3>
                <ul className="text-sm text-[#3D5068] space-y-1">
                  <li>Activación: vulnerabilidad crítica o falla grave</li>
                  <li>
                    Notificación: <strong>inmediata</strong> por correo y panel
                  </li>
                  <li>Duración objetivo: mínima posible</li>
                  <li>Postmortem publicado en 48h para P1</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-[#F4F6F9] rounded-lg text-xs text-[#7A8FA6]">
              Los mantenimientos programados dentro de la ventana definida no cuentan como tiempo de
              caída para el cálculo del SLA mensual.
            </div>
          </div>
        </Section>

        {/* 7. Soporte */}
        <Section id="soporte" title="7. Soporte y canales de atención">
          <div className="bg-white rounded-xl border border-[#DDE4ED] overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="text-left px-4 py-3 font-bold">Canal</th>
                  <th className="text-left px-4 py-3 font-bold">Uso</th>
                  <th className="text-center px-4 py-3 font-bold">Horario</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tickets en plataforma", "Soporte técnico P2, P3, P4", "L–V 8:00–18:00 COT"],
                  ["Correo: soporte@sigecc.co", "Consultas generales y P3/P4", "L–V 8:00–18:00 COT"],
                  ["Correo: urgencias@sigecc.co", "Incidentes críticos P1", "24/7 — 365 días"],
                ].map(([canal, uso, horario], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[#F4F6F9]" : "bg-white"}>
                    <td className="px-4 py-3 font-medium text-[#0D2340]">{canal}</td>
                    <td className="px-4 py-3 text-[#3D5068]">{uso}</td>
                    <td className="px-4 py-3 text-center text-xs text-[#7A8FA6]">{horario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 8. Créditos */}
        <Section id="creditos" title="8. Créditos por incumplimiento del SLA">
          <P>
            Si la disponibilidad mensual medida es inferior al 99.5% comprometido, el Cliente tendrá
            derecho a los siguientes créditos sobre el valor mensual del plan contratado:
          </P>
          <div className="bg-white rounded-xl border border-[#DDE4ED] overflow-hidden shadow-sm mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="text-left px-4 py-3 font-bold">Disponibilidad mensual real</th>
                  <th className="text-center px-4 py-3 font-bold">Crédito aplicable</th>
                  <th className="text-left px-4 py-3 font-bold">Tiempo de inactividad</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["99.0% – 99.5%", "10% del mes", "3.6 h – 7.2 h"],
                  ["95.0% – 99.0%", "25% del mes", "7.2 h – 36 h"],
                  ["90.0% – 95.0%", "50% del mes", "36 h – 72 h"],
                  ["< 90.0%", "100% del mes", "> 72 h"],
                ].map(([disp, credito, tiempo], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-[#F4F6F9]" : "bg-white"}>
                    <td className="px-4 py-3 text-[#3D5068]">{disp}</td>
                    <td className="px-4 py-3 text-center font-bold text-[#B8860B]">{credito}</td>
                    <td className="px-4 py-3 text-[#7A8FA6] text-xs">{tiempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#7A8FA6]">
            El crédito debe ser solicitado dentro de los 30 días calendario siguientes al mes
            afectado. Los créditos se aplican como descuento en la siguiente facturación, no como
            reembolso en efectivo.
          </p>
        </Section>

        {/* 9. Exclusiones */}
        <Section id="exclusiones" title="9. Exclusiones">
          <P>
            No se contabilizarán como tiempo de inactividad para efectos del SLA los siguientes
            eventos:
          </P>
          <ul className="text-sm text-[#3D5068] space-y-2">
            {[
              "Mantenimientos programados dentro de la ventana definida (domingos 2:00–4:00 AM COT), notificados con al menos 48 horas de anticipación.",
              "Interrupciones causadas por fuerza mayor: desastres naturales, conflictos armados, pandemia o fallas en infraestructura de internet fuera del control del Proveedor.",
              "Indisponibilidad causada por acciones del propio Cliente: uso incorrecto de la API, ejecución de scripts no autorizados, carga masiva de datos fuera de los límites del plan.",
              "Interrupciones de correo (Resend) cuando el resto de la plataforma esté operativa.",
              "Suspensión del servicio por incumplimiento de las condiciones comerciales del contrato por parte del Cliente.",
              "Ataques de denegación de servicio (DDoS) mientras el Proveedor toma medidas de mitigación.",
            ].map((exc, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#B8860B] font-bold shrink-0 mt-0.5">✕</span>
                <span>{exc}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 10. Obligaciones */}
        <Section id="obligaciones" title="10. Obligaciones del Cliente">
          <ul className="text-sm text-[#3D5068] space-y-2">
            {[
              "Mantener actualizados los datos de contacto del director y secretario del centro para recibir notificaciones de mantenimiento e incidentes.",
              "Usar la plataforma dentro de los límites del plan contratado (casos/año, personas en el centro, almacenamiento).",
              "Reportar incidentes con la mayor precisión posible: módulo afectado, descripción del error, hora de ocurrencia y capturas de pantalla.",
              "No compartir credenciales de acceso entre múltiples conciliadores. Cada persona del centro debe tener su propia cuenta.",
              "Realizar pruebas de nuevas configuraciones (plantillas, reglamento) en entorno controlado antes de habilitarlas en producción.",
            ].map((obl, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#0D2340] font-bold shrink-0 mt-0.5">✓</span>
                <span>{obl}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 11. Seguridad */}
        <Section id="seguridad" title="11. Seguridad y protección de datos">
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                titulo: "Cifrado en tránsito",
                desc: "TLS 1.2/1.3 en toda la comunicación. HTTPS forzado en producción.",
              },
              {
                titulo: "Cifrado en reposo",
                desc: "Datos en Supabase cifrados (AES-256). Documentos y poderes en Storage cifrados.",
              },
              {
                titulo: "Autenticación",
                desc: "NextAuth v5 con JWT firmados. Contraseñas hasheadas con bcrypt (salt 10). MFA disponible.",
              },
              {
                titulo: "Cabeceras de seguridad",
                desc: "X-Content-Type-Options, X-Frame-Options DENY, HSTS, X-XSS-Protection activos en producción.",
              },
              {
                titulo: "Protección de datos (Ley 1581/2012)",
                desc: "Los datos personales se tratan conforme a la Ley de Habeas Data de Colombia.",
              },
              {
                titulo: "Aislamiento multi-tenant",
                desc: "Cada centro accede únicamente a sus propios casos. RLS activo en 39 tablas sgcc_*.",
              },
            ].map((item) => (
              <div key={item.titulo} className="bg-white rounded-xl border border-[#DDE4ED] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-[#0D2340] text-sm">{item.titulo}</h3>
                </div>
                <p className="text-xs text-[#3D5068] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 12. Vigencia */}
        <Section id="vigencia" title="12. Vigencia y modificaciones">
          <div className="bg-white rounded-xl border border-[#DDE4ED] p-6 shadow-sm text-sm text-[#3D5068]">
            <p className="mb-3">
              Este SLA entra en vigor el <strong>{FECHA_VIGENCIA}</strong> y permanecerá vigente
              mientras exista una relación contractual activa entre el Cliente y el Proveedor.
            </p>
            <p className="mb-3">
              El Proveedor se reserva el derecho de modificar este documento en los siguientes casos:
            </p>
            <ul className="space-y-1 mb-4">
              <li className="flex gap-2">
                <span className="text-[#B8860B]">→</span> Cambio de proveedor de infraestructura.
              </li>
              <li className="flex gap-2">
                <span className="text-[#B8860B]">→</span> Modificaciones en los planes o precios.
              </li>
              <li className="flex gap-2">
                <span className="text-[#B8860B]">→</span> Revisión anual programada.
              </li>
              <li className="flex gap-2">
                <span className="text-[#B8860B]">→</span> Cumplimiento de nuevas disposiciones legales.
              </li>
            </ul>
            <p className="text-xs text-[#7A8FA6]">
              Cualquier modificación será notificada al Cliente con 30 días de anticipación por
              correo electrónico.
            </p>
          </div>
        </Section>

        <div className="border-t border-[#DDE4ED] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-lg font-black text-[#0D2340]">
              SIGECC<span className="text-[#B8860B]">.</span>
            </div>
            <div className="text-xs text-[#7A8FA6]">
              © {new Date().getFullYear()} — Todos los derechos reservados
            </div>
          </div>
          <Link
            href="/login"
            className="bg-[#0D2340] text-white font-bold px-6 py-2.5 rounded-lg text-sm hover:bg-[#1A3A62] transition-colors"
          >
            Ir a la plataforma →
          </Link>
        </div>
      </div>
    </div>
  );
}
