"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface LockHolder {
  userId: string;
  nombre: string;
  field: string;
  lockedAt: string;
}

interface UseEditLockOptions {
  channelName: string;
  userId: string;
  nombre: string;
}

/**
 * Hook transversal de bloqueo de edición — evita sobreescrituras cuando
 * dos usuarios editan el mismo recurso/campo.
 * Usa Supabase Realtime Broadcast.
 */
export function useEditLock({ channelName, userId, nombre }: UseEditLockOptions) {
  const [locks, setLocks] = useState<Map<string, LockHolder>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myLocksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !channelName) return;

    const channel = supabaseBrowser.channel(`locks:${channelName}`);

    channel
      .on("broadcast", { event: "lock" }, ({ payload }) => {
        setLocks((prev) => {
          const next = new Map(prev);
          next.set(payload.field, payload as LockHolder);
          return next;
        });
      })
      .on("broadcast", { event: "unlock" }, ({ payload }) => {
        setLocks((prev) => {
          const next = new Map(prev);
          next.delete(payload.field);
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Liberar todos mis locks al desmontar
      for (const field of myLocksRef.current) {
        channel.send({
          type: "broadcast",
          event: "unlock",
          payload: { field, userId },
        });
      }
      myLocksRef.current.clear();
      supabaseBrowser.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, userId, nombre]);

  const acquireLock = useCallback(
    (field: string) => {
      if (!channelRef.current) return false;

      // Si otro usuario tiene el lock, no permitir
      const existing = locks.get(field);
      if (existing && existing.userId !== userId) return false;

      channelRef.current.send({
        type: "broadcast",
        event: "lock",
        payload: { userId, nombre, field, lockedAt: new Date().toISOString() },
      });

      myLocksRef.current.add(field);

      setLocks((prev) => {
        const next = new Map(prev);
        next.set(field, { userId, nombre, field, lockedAt: new Date().toISOString() });
        return next;
      });

      return true;
    },
    [locks, userId, nombre],
  );

  const releaseLock = useCallback(
    (field: string) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: "broadcast",
        event: "unlock",
        payload: { field, userId },
      });

      myLocksRef.current.delete(field);

      setLocks((prev) => {
        const next = new Map(prev);
        next.delete(field);
        return next;
      });
    },
    [userId],
  );

  const isLockedByOther = useCallback(
    (field: string) => {
      const holder = locks.get(field);
      return holder ? holder.userId !== userId : false;
    },
    [locks, userId],
  );

  const getLockHolder = useCallback(
    (field: string): LockHolder | null => {
      const holder = locks.get(field);
      if (!holder || holder.userId === userId) return null;
      return holder;
    },
    [locks, userId],
  );

  return { locks, acquireLock, releaseLock, isLockedByOther, getLockHolder };
}
