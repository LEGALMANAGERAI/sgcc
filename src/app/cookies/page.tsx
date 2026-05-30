import Link from "next/link";

export const metadata = {
  title: "Política de cookies — SIGECC",
  description: "Información sobre las cookies que usa SIGECC y cómo gestionarlas.",
};

export default function CookiesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-slate-800">
      <h1 className="text-3xl font-bold mb-2 text-[#0D2340]">Política de cookies</h1>
      <p className="text-sm text-slate-500 mb-8">Última actualización: 29 de mayo de 2026</p>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-bold text-[#0D2340]">¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador para
          recordar información sobre tu visita (por ejemplo, que ya iniciaste sesión o que cerraste
          un banner). Algunas son indispensables para que la plataforma funcione; otras nos ayudan
          a entender de forma agregada cómo se usa SIGECC.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-bold text-[#0D2340]">Tipos de cookies que usamos</h2>
        <div>
          <h3 className="font-semibold">Esenciales (siempre activas)</h3>
          <p>
            Necesarias para tu sesión, autenticación y seguridad (NextAuth, CSRF). Sin ellas la
            plataforma no funciona, por lo que no se pueden desactivar. Aplican tanto a staff del
            centro como a partes que usan el portal.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Analíticas (opcionales)</h3>
          <p>
            Podemos usar herramientas de análisis como <strong>Google Analytics 4</strong> para
            entender de forma agregada y anónima cuántos centros visitan la plataforma y qué
            secciones usan más. Esto nos permite priorizar mejoras.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Sesión y experiencia (opcionales)</h3>
          <p>
            Podemos usar herramientas como <strong>Microsoft Clarity</strong> para registrar de
            forma anónima cómo se navega la plataforma (clics y desplazamiento) y detectar
            problemas de usabilidad. Estas herramientas enmascaran campos sensibles por defecto.
          </p>
        </div>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-bold text-[#0D2340]">¿Cómo gestiono mis preferencias?</h2>
        <p>
          Actualmente SIGECC solo usa cookies esenciales para la operación de la plataforma. Cuando
          activemos cookies analíticas u opcionales adicionales, te mostraremos un banner de
          consentimiento para que decidas qué categorías quieres permitir.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h2 className="text-xl font-bold text-[#0D2340]">Marco legal</h2>
        <p>
          Tratamos tus datos personales conforme a la <strong>Ley 1581 de 2012</strong> y al{" "}
          <strong>Decreto 1377 de 2013</strong> de Colombia (régimen de Habeas Data). Para más
          información sobre cómo manejamos tus datos consulta nuestros{" "}
          <Link
            href="/terminos"
            className="text-[#1B5FA8] font-semibold underline"
          >
            Términos y condiciones
          </Link>{" "}
          y nuestro{" "}
          <Link
            href="/sla"
            className="text-[#1B5FA8] font-semibold underline"
          >
            Acuerdo de Nivel de Servicio
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#0D2340]">Contacto</h2>
        <p>
          Si tienes dudas sobre nuestra política de cookies o el tratamiento de tus datos
          personales, escríbenos a{" "}
          <a
            href="mailto:soporte@sigecc.co"
            className="text-[#1B5FA8] font-semibold underline"
          >
            soporte@sigecc.co
          </a>
          .
        </p>
      </section>
    </main>
  );
}
