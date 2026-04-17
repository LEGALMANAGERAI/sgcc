"use client";

import { usePresence } from "@/hooks/usePresence";
import { PresenceAvatars } from "./PresenceAvatars";

interface Props {
  resourceType: string;
  resourceId: string;
  userId: string;
  nombre: string;
  rol: string;
}

/**
 * Barra de colaboración reutilizable que muestra presencia en cualquier recurso.
 * Se coloca al tope de una página de detalle (expediente, audiencia, correspondencia).
 */
export function CollaborationBar({ resourceType, resourceId, userId, nombre, rol }: Props) {
  const channelName = `presence:${resourceType}:${resourceId}`;
  const page = `/${resourceType}/${resourceId}`;

  const { users, otherUsers, onlineCount } = usePresence({
    channelName,
    userId,
    nombre,
    rol,
    page,
  });

  // Siempre visible: muestra estado de conexión + quién está
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded-lg mb-4 border ${
      onlineCount > 1
        ? "bg-blue-50 border-blue-100"
        : "bg-gray-50 border-gray-200"
    }`}>
      <div className="flex items-center gap-3">
        {/* Indicador de conexión */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? "bg-green-400 animate-pulse" : "bg-gray-300"}`} />
          <span className="text-xs text-gray-500">
            {onlineCount === 0
              ? "Conectando..."
              : onlineCount === 1
                ? `Tú (${nombre})`
                : `${onlineCount} conectados`}
          </span>
        </div>
        {otherUsers.length > 0 && <PresenceAvatars users={otherUsers} />}
      </div>
      {onlineCount > 1 && (
        <span className="text-xs text-blue-600 font-medium">
          Colaboración en tiempo real activa
        </span>
      )}
    </div>
  );
}
