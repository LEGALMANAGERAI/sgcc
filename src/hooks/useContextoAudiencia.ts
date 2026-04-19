"use client";

import { useCallback, useEffect, useState } from "react";

export interface ContextoAudiencia {
  caso: any;
  audiencia: any;
  apoderadosVigentes: any[];
  asistencia: any[];
  ultimaActa: any | null;
  historialApoderados: any[];
}

export function useContextoAudiencia(caseId: string, hearingId: string | null) {
  const [data, setData] = useState<ContextoAudiencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContexto = useCallback(async () => {
    if (!hearingId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/casos/${caseId}/audiencia/${hearingId}/contexto`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error cargando contexto de la audiencia");
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message ?? "Error cargando contexto");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, hearingId]);

  useEffect(() => {
    fetchContexto();
  }, [fetchContexto]);

  return { data, loading, error, refresh: fetchContexto };
}
