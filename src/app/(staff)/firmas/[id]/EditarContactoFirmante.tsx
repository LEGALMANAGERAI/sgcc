"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

interface Props {
  documentId: string;
  firmanteId: string;
  nombre: string;
  cedula: string;
  email: string;
  telefono: string | null;
  canalNotificacion: string;
  /** false = documento aún no enviado: no hay nada que reenviar. */
  enviado: boolean;
}

type Canal = "email" | "whatsapp";

export function EditarContactoFirmante({
  documentId,
  firmanteId,
  nombre,
  cedula,
  email: emailInicial,
  telefono: telefonoInicial,
  canalNotificacion,
  enviado,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(emailInicial);
  const [telefono, setTelefono] = useState(telefonoInicial ?? "");
  const [canales, setCanales] = useState<Canal[]>(() => {
    const c = canalNotificacion.split(",").map((s) => s.trim());
    const sel: Canal[] = [];
    if (c.includes("email") || c.length === 0 || !c[0]) sel.push("email");
    if (c.includes("whatsapp")) sel.push("whatsapp");
    return sel;
  });
  const [reenviar, setReenviar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggle = (c: Canal) =>
    setCanales((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!email.trim()) return setMsg({ type: "error", text: "El correo es obligatorio." });
    if (canales.length === 0)
      return setMsg({ type: "error", text: "Seleccione al menos un canal." });
    if (canales.includes("whatsapp") && !telefono.trim())
      return setMsg({ type: "error", text: "WhatsApp requiere un número de celular." });

    setLoading(true);
    try {
      const res = await fetch(`/api/firmas/${documentId}/firmantes/${firmanteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          telefono: telefono.trim() || undefined,
          canales,
          reenviar: enviado && reenviar,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reenvio?: unknown;
        reenvio_omitido?: string;
      };
      if (!res.ok) {
        setMsg({ type: "error", text: data.error ?? "Error al guardar el contacto" });
        return;
      }
      const extra = !enviado
        ? " Se usará al enviar."
        : data.reenvio
          ? " Se reenvió el enlace de firma."
          : data.reenvio_omitido
            ? ` No se reenvió: ${data.reenvio_omitido}`
            : "";
      setMsg({ type: "success", text: `Contacto actualizado.${extra}` });
      setOpen(false);
      router.refresh();
    } catch {
      setMsg({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  const idp = `ec-${firmanteId}`;
  const input =
    "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F9B]";

  return (
    <div className="mt-1">
      {!open && (
        <button
          type="button"
          onClick={() => {
            setMsg(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1 text-xs text-[#1B4F9B] hover:underline"
        >
          <Pencil className="w-3 h-3" />
          Editar contacto
        </button>
      )}
      {msg && !open && (
        <p
          role={msg.type === "error" ? "alert" : "status"}
          className={`text-xs mt-1 ${msg.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {msg.text}
        </p>
      )}
      {open && (
        <form
          onSubmit={guardar}
          className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 max-w-sm"
        >
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-900">{nombre}</span> · C.C. {cedula}
          </p>
          <div>
            <label htmlFor={`${idp}-email`} className="block text-xs text-gray-600 mb-1">
              Correo
            </label>
            <input
              id={`${idp}-email`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor={`${idp}-tel`} className="block text-xs text-gray-600 mb-1">
              Celular
            </label>
            <input
              id={`${idp}-tel`}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={input}
            />
          </div>
          <fieldset>
            <legend className="text-xs text-gray-600 mb-1">Canales de notificación</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={canales.includes("email")}
                  onChange={() => toggle("email")}
                />
                Correo
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={canales.includes("whatsapp")}
                  onChange={() => toggle("whatsapp")}
                />
                WhatsApp
              </label>
            </div>
          </fieldset>
          {enviado && (
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={reenviar} onChange={(e) => setReenviar(e.target.checked)} />
              Reenviar ahora
            </label>
          )}
          {msg && (
            <p role="alert" className="text-xs text-red-600">
              {msg.text}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D2340] text-white rounded-lg text-sm font-medium hover:bg-[#0d2340dd] disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setOpen(false);
                setMsg(null);
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
