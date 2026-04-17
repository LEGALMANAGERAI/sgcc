"use client";

import { useEffect, useState, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  nombre: string;
  rol: string;
  page: string;
  joinedAt: string;
}

interface UsePresenceOptions {
  channelName: string;
  userId: string;
  nombre: string;
  rol: string;
  page: string;
}

/**
 * Hook transversal de presencia — trackea qué usuarios están viendo una página/recurso.
 * Usa Supabase Realtime Presence.
 */
export function usePresence({ channelName, userId, nombre, rol, page }: UsePresenceOptions) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId || !channelName || typeof window === "undefined" || !supabaseBrowser) return;

    const channel = supabaseBrowser.channel(channelName, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const present: PresenceUser[] = [];
        for (const [, entries] of Object.entries(state)) {
          if (entries.length > 0) {
            present.push(entries[0]);
          }
        }
        setUsers(present);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            nombre,
            rol,
            page,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabaseBrowser.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, userId, nombre, rol, page]);

  // Otros usuarios (excluye al usuario actual)
  const otherUsers = users.filter((u) => u.userId !== userId);

  return { users, otherUsers, onlineCount: users.length };
}
