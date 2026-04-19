"use client";
import type { PersonaFormData } from "@/types/solicitudes";

interface Props {
  value: PersonaFormData;
  onChange: (patch: Partial<PersonaFormData>) => void;
  showCiudad?: boolean;
}

export function PersonaForm({ value, onChange, showCiudad = true }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        {(["natural", "juridica"] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.tipo_persona === t}
              onChange={() => onChange({ tipo_persona: t })}
              className="accent-[#0D2340]"
            />
            {t === "natural" ? "Persona Natural" : "Persona Jurídica"}
          </label>
        ))}
      </div>

      {value.tipo_persona === "natural" ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombres *"
            val={value.nombres ?? ""}
            onC={(v) => onChange({ nombres: v })}
          />
          <Input
            label="Apellidos *"
            val={value.apellidos ?? ""}
            onC={(v) => onChange({ apellidos: v })}
          />
          <Select
            label="Tipo documento"
            val={value.tipo_doc ?? "CC"}
            onC={(v) => onChange({ tipo_doc: v })}
            opts={[
              ["CC", "C.C."],
              ["CE", "C.E."],
              ["TI", "T.I."],
              ["Pasaporte", "Pasaporte"],
              ["PPT", "PPT"],
            ]}
          />
          <Input
            label="Número documento *"
            val={value.numero_doc ?? ""}
            onC={(v) => onChange({ numero_doc: v })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Razón social *"
            val={value.razon_social ?? ""}
            onC={(v) => onChange({ razon_social: v })}
          />
          <Input
            label="NIT *"
            val={value.nit_empresa ?? ""}
            onC={(v) => onChange({ nit_empresa: v })}
          />
          <Input
            label="Representante legal"
            val={value.representante_legal ?? ""}
            onC={(v) => onChange({ representante_legal: v })}
            className="col-span-2"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Email *"
          type="email"
          val={value.email}
          onC={(v) => onChange({ email: v })}
        />
        <Input
          label="Teléfono"
          val={value.telefono ?? ""}
          onC={(v) => onChange({ telefono: v })}
        />
        {showCiudad && (
          <Input
            label="Ciudad"
            val={value.ciudad ?? ""}
            onC={(v) => onChange({ ciudad: v })}
            className="col-span-2"
          />
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  val,
  onC,
  type = "text",
  className = "",
}: {
  label: string;
  val: string;
  onC: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={val}
        onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
      />
    </div>
  );
}

function Select({
  label,
  val,
  onC,
  opts,
  className = "",
}: {
  label: string;
  val: string;
  onC: (v: string) => void;
  opts: [string, string][];
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      <select
        value={val}
        onChange={(e) => onC(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D2340]"
      >
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
