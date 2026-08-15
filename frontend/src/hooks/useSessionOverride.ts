/**
 * PamuDeX — Tareas 3.3 / 3.4 / 3.5
 * Hook común para leer y escribir los overrides de la sesión activa.
 *
 * Todo el documento de overrides vive en `sessions.data_json`. Aquí se carga
 * una vez, se modifica en memoria y se guarda entero con PUT /api/sessions/:id.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { sessionsApi, type Session } from "../lib/apiSession";
import { useActiveSession } from "../lib/session";
import { invalidarSesion } from "../lib/localCache";

export type OverrideEntity = "types" | "pokemon" | "moves" | "abilities";

export type EntityPatch = Record<string, unknown>;

export interface OverrideDoc {
  types?: Record<string, EntityPatch>;
  pokemon?: Record<string, EntityPatch>;
  moves?: Record<string, EntityPatch>;
  abilities?: Record<string, EntityPatch>;
  relations?: Record<string, Record<string, number>>;
  theme?: Record<string, string>;
}

export interface SessionOverrides {
  sessionId: number | null;
  session: Session | null;
  doc: OverrideDoc;
  loading: boolean;
  saving: boolean;
  error: string | null;
  savedAt: number | null;
  reload: () => void;
  /** Guarda (mezclando) el override de una entidad concreta. */
  saveEntity: (entity: OverrideEntity, id: string | number, patch: EntityPatch) => Promise<void>;
  /** Borra el override de una entidad: vuelve al valor global. */
  resetEntity: (entity: OverrideEntity, id: string | number) => Promise<void>;
  setRelation: (attacker: string, defender: string, multiplier: number) => Promise<void>;
  resetRelations: () => Promise<void>;
  setTheme: (theme: Record<string, string> | null) => Promise<void>;
}

function readDoc(session: Session | null): OverrideDoc {
  if (!session) return {};
  if (session.data && typeof session.data === "object") return session.data as OverrideDoc;
  if (typeof session.data_json === "string") {
    try {
      const parsed = JSON.parse(session.data_json);
      if (parsed && typeof parsed === "object") return parsed as OverrideDoc;
    } catch {
      /* data_json corrupto: se empieza de cero */
    }
  }
  return {};
}

export function useSessionOverrides(): SessionOverrides {
  const [sessionId] = useActiveSession();
  const [session, setSession] = useState<Session | null>(null);
  const [doc, setDoc] = useState<OverrideDoc>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (sessionId === null) {
      setSession(null);
      setDoc({});
      return;
    }
    setLoading(true);
    setError(null);
    sessionsApi
      .get(sessionId)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setDoc(readDoc(data));
      })
      .catch(() => {
        if (!cancelled) setError("load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const persist = useCallback(
    async (next: OverrideDoc) => {
      if (sessionId === null) return;
      setSaving(true);
      setError(null);
      const previous = doc;
      setDoc(next); // optimista: la vista responde al instante
      try {
        await sessionsApi.update(sessionId, { data: next });
        // La caché local del catálogo (8.4) responde sin preguntar a nadie, así
        // que hay que tirarle la copia de ESTA sesión: si no, editar un Pokémon
        // y volver al listado seguiría enseñando el valor de antes. `persist`
        // es el único camino de escritura del hook, así que basta con hacerlo
        // aquí y no en cada una de las cinco funciones que lo llaman.
        void invalidarSesion(sessionId);
        setSavedAt(Date.now());
      } catch {
        setDoc(previous);
        setError("save");
      } finally {
        setSaving(false);
      }
    },
    [sessionId, doc]
  );

  const saveEntity = useCallback(
    async (entity: OverrideEntity, id: string | number, patch: EntityPatch) => {
      const key = String(id);
      const bucket = { ...(doc[entity] || {}) };
      const merged = { ...(bucket[key] || {}), ...patch };

      // Una clave con valor undefined significa "vuelve al valor global".
      for (const field of Object.keys(merged)) {
        if (merged[field] === undefined) delete merged[field];
      }

      if (Object.keys(merged).length === 0) delete bucket[key];
      else bucket[key] = merged;

      await persist({ ...doc, [entity]: bucket });
    },
    [doc, persist]
  );

  const resetEntity = useCallback(
    async (entity: OverrideEntity, id: string | number) => {
      const bucket = { ...(doc[entity] || {}) };
      delete bucket[String(id)];
      await persist({ ...doc, [entity]: bucket });
    },
    [doc, persist]
  );

  const setRelation = useCallback(
    async (attacker: string, defender: string, multiplier: number) => {
      const relations = { ...(doc.relations || {}) };
      const row = { ...(relations[attacker] || {}) };
      row[defender] = multiplier;
      relations[attacker] = row;
      await persist({ ...doc, relations });
    },
    [doc, persist]
  );

  const resetRelations = useCallback(async () => {
    const next = { ...doc };
    delete next.relations;
    await persist(next);
  }, [doc, persist]);

  const setTheme = useCallback(
    async (theme: Record<string, string> | null) => {
      const next = { ...doc };
      if (theme === null) delete next.theme;
      else next.theme = theme;
      await persist(next);
    },
    [doc, persist]
  );

  return useMemo(
    () => ({
      sessionId,
      session,
      doc,
      loading,
      saving,
      error,
      savedAt,
      reload,
      saveEntity,
      resetEntity,
      setRelation,
      resetRelations,
      setTheme,
    }),
    [
      sessionId, session, doc, loading, saving, error, savedAt,
      reload, saveEntity, resetEntity, setRelation, resetRelations, setTheme,
    ]
  );
}

/** Azúcar para trabajar con una sola entidad, como pedía el encargo 3.4. */
export function useSessionOverride(
  overrides: SessionOverrides,
  entity: OverrideEntity,
  id: string | number | null
) {
  const key = id === null ? null : String(id);
  const bucket = overrides.doc[entity] || {};
  const override: EntityPatch = key !== null && bucket[key] ? bucket[key] : {};

  const save = useCallback(
    (patch: EntityPatch) => (key === null ? Promise.resolve() : overrides.saveEntity(entity, key, patch)),
    [overrides, entity, key]
  );
  const reset = useCallback(
    () => (key === null ? Promise.resolve() : overrides.resetEntity(entity, key)),
    [overrides, entity, key]
  );

  return { override, save, reset, saving: overrides.saving, isModified: Object.keys(override).length > 0 };
}
