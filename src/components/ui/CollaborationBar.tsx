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

  const { otherUsers, onlineCount } = usePresence({
    channelName,
    userId,
    nombre,
    rol,
    page,
  });

  if (onlineCount <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg mb-4">
      <PresenceAvatars users={otherUsers} />
      <span className="text-xs text-blue-600">
        Colaboración en tiempo real activa
      </span>
    </div>
  );
}
