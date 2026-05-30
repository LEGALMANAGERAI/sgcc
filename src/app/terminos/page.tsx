import Link from "next/link";

export const metadata = {
  title: "Términos y Condiciones — SIGECC",
  description:
    "Términos y condiciones de uso de la plataforma SIGECC para centros de conciliación en Colombia.",
};

const FECHA_VIGENCIA = "29 de mayo de 2026";
const VERSION = "v1.0";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-xl font-black text-[#0D2340] mb-4 pb-2 border-b-2 border-[#B8860B]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#3D5068] leading-relaxed mb-3">{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-[#3D5068] leading-relaxed mb-1.5">
      <span className="text-[#B8860B] font-bold mt-0.5">›</span>
      <span>{children}</span>
    </li>
  );
}

export default function TerminosPage() {
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
            Términos y Condiciones de Uso
          </h1>
          <p className="text-white/70 text-sm max-w-2xl">
            Al crear una cuenta o usar SIGECC, aceptas los presentes términos en su totalidad. Léelos
            con atención antes de registrarte.
          </p>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/50">
            <span>
              Versión: <strong className="text-white/80">{VERSION}</strong>
            </span>
            <span>
              Vigente desde: <strong className="text-white/80">{FECHA_VIGENCIA}</strong>
            </span>
            <span>
              Gobernado por: <strong className="text-white/80">Leyes de Colombia</strong>
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <nav className="bg-white border border-[#DDE4ED] rounded-xl p-5 mb-10 shadow-sm">
          <p className="text-[11px] font-bold text-[#7A8FA6] uppercase tracking-widest mb-3">
            Contenido
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ["#operador", "1. Operador"],
              ["#aceptacion", "2. Aceptación"],
              ["#planes", "3. Planes y servicios"],
              ["#pagos", "4. Pagos"],
              ["#uso-aceptable", "5. Uso aceptable"],
              ["#contenido", "6. Contenido del usuario"],
              ["#partes", "7. Partes y portal"],
              ["#pi", "8. Propiedad intelectual"],
              ["#disponibilidad", "9. Disponibilidad"],
              ["#privacidad", "10. Privacidad"],
              ["#responsabilidad", "11. Responsabilidad"],
              ["#terminacion", "12. Terminación"],
              ["#ley", "13. Ley y jurisdicción"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-xs text-[#1B5FA8] hover:underline font-medium"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <Section id="operador" title="1. Información del Operador">
          <div className="bg-[#F8FAFC] border border-[#DDE4ED] rounded-xl p-5 text-sm text-[#3D5068] space-y-1">
            <p>
              <strong className="text-[#0D2340]">SIGECC</strong>
            </p>
            <p>Sistema de Gestión para Centros de Conciliación</p>
            <p>República de Colombia</p>
            <p>
              Correo:{" "}
              <a
                href="mailto:legal@sigecc.co"
                className="text-[#1B5FA8] hover:underline"
              >
                legal@sigecc.co
              </a>
            </p>
            <p className="text-xs text-[#94A3B8] mt-2">
              * Razón social del operador pendiente de publicación. Este documento se actualizará al
              constituirse formalmente la empresa operadora.
            </p>
          </div>
        </Section>

        <Section id="aceptacion" title="2. Aceptación de los Términos">
          <P>
            Al hacer clic en <strong>"Acepto los Términos y Condiciones"</strong>, crear una cuenta
            de centro o usar la plataforma, manifiestas haber leído, entendido y aceptado estos
            Términos y el{" "}
            <Link
              href="/sla"
              className="text-[#1B5FA8] hover:underline font-medium"
            >
              Acuerdo de Nivel de Servicio (SLA)
            </Link>
            , conforme a la <strong>Ley 527 de 1999</strong> sobre comercio electrónico colombiano.
          </P>
          <P>
            Si actúas en representación de un centro de conciliación, notaría, consultorio jurídico
            universitario o cámara de comercio, declaras tener facultades suficientes para vincular
            a la institución.
          </P>
        </Section>

        <Section id="planes" title="3. Planes y Servicios">
          <P>SIGECC está disponible en los siguientes planes de suscripción:</P>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#0D2340] text-white">
                  <th className="text-left px-3 py-2.5 rounded-tl-lg font-bold text-xs">Plan</th>
                  <th className="text-center px-3 py-2.5 font-bold text-xs">Casos/año</th>
                  <th className="text-center px-3 py-2.5 font-bold text-xs">Personas</th>
                  <th className="text-center px-3 py-2.5 rounded-tr-lg font-bold text-xs">
                    Mensual COP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE4ED]">
                {[
                  ["Académico", "50", "5", "Gratis"],
                  ["Privado Esencial", "100", "5", "$490.000"],
                  ["Privado Profesional", "400", "15", "$1.090.000"],
                  ["Notarial / Multi-sede", "800", "25", "$1.990.000"],
                  ["Enterprise", "Ilimitado", "Ilimitado", "desde $3.500.000"],
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F8FAFC]"}>
                    {row.map((c, j) => (
                      <td
                        key={j}
                        className={`px-3 py-2 text-xs ${j === 0 ? "text-[#0D2340] font-medium" : "text-center text-[#3D5068]"}`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Las tarifas vigentes se publican en la plataforma y pueden modificarse con 30 días de
            anticipación. Los excedentes (casos adicionales, personas adicionales) se cobran según
            tarifa publicada en{" "}
            <Link href="/precios" className="text-[#1B5FA8] hover:underline font-medium">
              /precios
            </Link>
            .
          </P>
        </Section>

        <Section id="pagos" title="4. Pagos y Facturación">
          <ul className="space-y-1 mb-4">
            <Li>Los planes se facturan de forma anticipada (mensual o anual).</Li>
            <Li>SIGECC emite factura electrónica conforme a los requisitos de la DIAN.</Li>
            <Li>En caso de mora, el servicio puede suspenderse con aviso previo de 72 horas.</Li>
            <Li>
              Los períodos ya pagados no son reembolsables, salvo falla atribuible a SIGECC superior
              a 72 horas continuas.
            </Li>
            <Li>
              Los períodos de prueba gratuita (15 días) se suspenden automáticamente al vencimiento
              si no se completa la suscripción. Tus datos se conservan 30 días.
            </Li>
          </ul>
        </Section>

        <Section id="uso-aceptable" title="5. Uso Aceptable">
          <P>
            El usuario se compromete a <strong>NO</strong>:
          </P>
          <ul className="space-y-1">
            <Li>
              Usar la plataforma para actividades ilícitas o contrarias a la normativa colombiana,
              en especial Ley 2220/2022 y Ley 2445/2025.
            </Li>
            <Li>
              Almacenar información obtenida de forma ilegal o sin autorización de sus titulares.
            </Li>
            <Li>Intentar acceder a casos o expedientes de otros centros.</Li>
            <Li>
              Realizar ingeniería inversa, descompilar o extraer el código fuente de la plataforma.
            </Li>
            <Li>Compartir credenciales entre conciliadores o staff.</Li>
            <Li>Usar bots, scrapers u otras herramientas automatizadas no autorizadas.</Li>
            <Li>
              Generar actas o documentos con fines distintos a la conciliación, insolvencia o
              acuerdos de apoyo que regula el centro.
            </Li>
          </ul>
        </Section>

        <Section id="contenido" title="6. Contenido del Centro">
          <ul className="space-y-1">
            <Li>El centro conserva todos los derechos sobre los expedientes y documentos que cargue.</Li>
            <Li>SIGECC no adquiere ningún derecho de propiedad sobre dicho contenido.</Li>
            <Li>
              El centro es el único responsable de los documentos cargados, incluyendo las
              autorizaciones de tratamiento de datos personales de las partes.
            </Li>
            <Li>
              Está prohibido subir contenido que infrinja derechos de terceros, información ilegal
              o malware.
            </Li>
          </ul>
        </Section>

        <Section id="partes" title="7. Partes y Portal Público">
          <P>
            SIGECC ofrece un portal público para que las partes (convocantes y convocados) accedan a
            sus expedientes. El acceso se valida por documento de identidad, no por correo, para
            cumplir con la radicación virtual de Ley 2445.
          </P>
          <ul className="space-y-1">
            <Li>El centro es responsable de validar la identidad de las partes antes de habilitar acceso.</Li>
            <Li>El widget embebible solo expone los endpoints autorizados por el centro.</Li>
            <Li>
              SIGECC aplica rate limit y validación anti-spam en endpoints públicos como capa
              adicional de seguridad.
            </Li>
          </ul>
        </Section>

        <Section id="pi" title="8. Propiedad Intelectual">
          <P>
            La plataforma, su código fuente, diseño, marca <strong>SIGECC</strong> y todos los
            componentes son propiedad exclusiva de su operador, protegidos por la{" "}
            <strong>Ley 23 de 1982</strong> y la <strong>Decisión Andina 351 de 1993</strong>.
          </P>
          <P>
            Nada en estos Términos transfiere al usuario ningún derecho de propiedad intelectual
            sobre la plataforma o sus componentes.
          </P>
        </Section>

        <Section id="disponibilidad" title="9. Disponibilidad del Servicio">
          <P>
            SIGECC procura que la plataforma esté disponible 24/7. Los compromisos específicos de
            disponibilidad, mantenimientos y compensaciones están detallados en el{" "}
            <Link href="/sla" className="text-[#1B5FA8] hover:underline font-medium">
              Acuerdo de Nivel de Servicio (SLA)
            </Link>
            , que forma parte integral de estos Términos.
          </P>
        </Section>

        <Section id="privacidad" title="10. Privacidad y Datos Personales">
          <P>
            El tratamiento de datos personales se rige por la <strong>Ley 1581 de 2012</strong> y el{" "}
            <strong>Decreto 1377 de 2013</strong>. SIGECC actúa como Encargado del Tratamiento y
            solo procesa los datos para prestar el servicio contratado. El centro, como Responsable
            del Tratamiento, garantiza contar con las autorizaciones de los titulares de datos
            (partes, apoderados, acreedores) que ingrese a la plataforma.
          </P>
          <P>
            Ante un incidente de seguridad que afecte datos personales, SIGECC notificará al centro
            dentro de las <strong>72 horas</strong> siguientes a su conocimiento, conforme a la
            normativa vigente.
          </P>
        </Section>

        <Section id="responsabilidad" title="11. Limitación de Responsabilidad">
          <P>SIGECC no será responsable por:</P>
          <ul className="space-y-1 mb-4">
            <Li>Pérdida de datos causada por acción u omisión del centro.</Li>
            <Li>Daños indirectos, incidentales o consecuentes, incluyendo pérdida de ingresos.</Li>
            <Li>Decisiones tomadas con base en el uso de la plataforma.</Li>
            <Li>Fuerza mayor o caso fortuito conforme al Código Civil colombiano.</Li>
            <Li>Fallas en servicios de terceros (internet, proveedores de nube, etc.).</Li>
          </ul>
          <P>
            La responsabilidad máxima de SIGECC no excederá el valor total pagado por el centro en
            los últimos <strong>6 meses</strong>.
          </P>
        </Section>

        <Section id="terminacion" title="12. Terminación">
          <ul className="space-y-1 mb-4">
            <Li>El centro puede cancelar su suscripción en cualquier momento desde la configuración.</Li>
            <Li>
              SIGECC puede suspender o terminar cuentas que incumplan estos Términos, previo aviso
              cuando sea posible.
            </Li>
            <Li>
              Al terminar la suscripción, el centro tiene <strong>30 días</strong> para exportar sus
              expedientes y documentos.
            </Li>
            <Li>
              Transcurrido dicho plazo, SIGECC eliminará los datos dentro de los{" "}
              <strong>30 días</strong> siguientes, salvo obligación legal de retención.
            </Li>
          </ul>
        </Section>

        <Section id="ley" title="13. Ley Aplicable y Jurisdicción">
          <P>
            Estos Términos se rigen por las leyes de la República de Colombia, especialmente: Ley
            527/99 (comercio electrónico), Ley 1581/12 (Habeas Data), Ley 2220/2022 (estatuto de
            conciliación), Ley 2445/2025 (insolvencia PNNC), Decreto 1136/2025 (audiencias
            virtuales) y Ley 1480/11 (consumidor). Para controversias no resueltas directamente, las
            partes se someten a los jueces competentes de Colombia. El usuario consumidor puede
            también acudir a la{" "}
            <strong>Superintendencia de Industria y Comercio (SIC)</strong>.
          </P>
        </Section>

        <div className="border-t border-[#DDE4ED] pt-8 mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-[#7A8FA6]">
            <p className="font-bold text-[#0D2340]">SIGECC</p>
            <p>
              Versión {VERSION} — Vigente desde {FECHA_VIGENCIA}
            </p>
            <p>© {new Date().getFullYear()} — Todos los derechos reservados</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/sla"
              className="text-xs font-bold text-[#1B5FA8] hover:underline border border-[#DDE4ED] px-3 py-1.5 rounded-lg"
            >
              Ver SLA →
            </Link>
            <Link
              href="/registro"
              className="text-xs font-bold bg-[#0D2340] text-white px-4 py-1.5 rounded-lg hover:bg-[#1A3A62] transition-colors"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
