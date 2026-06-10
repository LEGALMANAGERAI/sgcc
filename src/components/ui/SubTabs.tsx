import Link from "next/link";
import { clsx } from "clsx";

export interface SubTab {
  key: string;
  label: string;
}

interface SubTabsProps {
  /** Ruta base sin querystring, ej: `/expediente/abc` */
  basePath: string;
  /** Clave de la pestaña padre, ej: `documentos` */
  tab: string;
  /** Sub-pestañas a mostrar */
  subTabs: SubTab[];
  /** Sub-pestaña activa */
  activeSub: string;
}

export function SubTabs({ basePath, tab, subTabs, activeSub }: SubTabsProps) {
  return (
    <div className="mb-5">
      <nav className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
        {subTabs.map((st) => {
          const isActive = activeSub === st.key;
          return (
            <Link
              key={st.key}
              href={`${basePath}?tab=${tab}&sub=${st.key}`}
              className={clsx(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-white text-[#0D2340] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {st.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
