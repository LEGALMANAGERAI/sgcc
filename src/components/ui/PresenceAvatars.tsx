"use client";

import type { PresenceUser } from "@/hooks/usePresence";

interface Props {
  users: PresenceUser[];
  maxVisible?: number;
}

const ROL_COLORS: Record<string, string> = {
  admin: "bg-purple-500",
  conciliador: "bg-blue-500",
  secretario: "bg-green-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Muestra avatares circulares de los usuarios conectados en tiempo real.
 * Se usa en cualquier página para indicar quién está viendo.
 */
export function PresenceAvatars({ users, maxVisible = 5 }: Props) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {visible.map((u) => (
          <div
            key={u.userId}
            title={`${u.nombre} (${u.rol})`}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white ${ROL_COLORS[u.rol] ?? "bg-gray-500"}`}
          >
            {getInitials(u.nombre)}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white" />
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-300 text-gray-700 text-xs font-bold ring-2 ring-white">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500 ml-1">
        {users.length} {users.length === 1 ? "conectado" : "conectados"}
      </span>
    </div>
  );
}
