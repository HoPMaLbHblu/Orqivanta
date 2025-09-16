'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDocumentAction } from '@/actions/documents';
import type { ConflictState } from './conflict-dialog';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'offline' | 'conflict';

const DEBOUNCE_MS = 1200;

/**
 * Debounced autosave with optimistic concurrency. Every save sends the version the editor
 * started from; when the server reports a newer version, saving pauses and the caller gets
 * a conflict to resolve. Nothing is retried or overwritten behind the person's back.
 */
export function useDocumentAutosave({ org, documentId, initial, enabled }: { org: string; documentId: string; initial: { version: number; title: string; content: unknown }; enabled: boolean }) {
  const base = useRef(initial.version);
  const title = useRef(initial.title);
  const content = useRef<unknown>(initial.content);
  const dirty = useRef(false);
  const saving = useRef(false);
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedVersion, setSavedVersion] = useState(initial.version);
  const [saved, setSaved] = useState({ title: initial.title, content: initial.content });

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!enabled || paused.current) return !dirty.current;
    if (saving.current) {
      // A save is in flight; it reschedules itself if more edits arrived.
      return false;
    }
    if (!dirty.current) return true;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      return false;
    }
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    // Plain-clone the editor JSON: server actions reject anything that isn't plain data.
    const snapshot = { title: title.current, content: JSON.parse(JSON.stringify(content.current ?? null)) as unknown };
    try {
      const res = await saveDocumentAction(org, { documentId, baseVersion: base.current, title: snapshot.title, content: snapshot.content });
      if (res.ok) {
        base.current = res.data.version;
        setSavedVersion(res.data.version);
        setSavedAt(new Date(res.data.updatedAt));
        setSaved(snapshot);
        setError(null);
        if (dirty.current) {
          setStatus('dirty');
          timer.current = setTimeout(() => void flush(), 300);
        } else setStatus('saved');
        return !dirty.current;
      }
      dirty.current = true;
      if (res.error.code === 'CONFLICT') {
        const cur = (res.error.current ?? {}) as Partial<ConflictState['theirs']>;
        paused.current = true;
        setConflict({
          theirs: { version: Number(cur.version), title: cur.title ?? '', content: cur.content ?? null, updatedAt: cur.updatedAt ?? null, updatedByName: cur.updatedByName ?? null },
          mine: { title: title.current, content: content.current },
        });
        setStatus('conflict');
      } else {
        setError(res.error.message);
        setStatus('error');
      }
      return false;
    } catch {
      // Network failure or the server was unreachable: keep the edits and offer a retry.
      dirty.current = true;
      setError(null);
      setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
      return false;
    } finally {
      saving.current = false;
    }
  }, [org, documentId, enabled]);

  const change = useCallback(
    (patch: { title?: string; content?: unknown }) => {
      if (patch.title !== undefined) title.current = patch.title;
      if (patch.content !== undefined) content.current = patch.content;
      dirty.current = true;
      if (paused.current) return;
      if (!saving.current) setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    },
    [flush],
  );

  /** Replace local state with a version from the server (after "keep theirs" or a live update). */
  const adopt = useCallback((v: { version: number; title: string; content: unknown; updatedAt?: string | Date | null }) => {
    if (timer.current) clearTimeout(timer.current);
    base.current = v.version;
    title.current = v.title;
    content.current = v.content;
    dirty.current = false;
    paused.current = false;
    setSavedVersion(v.version);
    setSaved({ title: v.title, content: v.content });
    if (v.updatedAt) setSavedAt(new Date(v.updatedAt));
    setConflict(null);
    setError(null);
    setStatus('saved');
  }, []);

  /** Keep my edits and save them on top of the newer version. */
  const overwrite = useCallback(async () => {
    if (!conflict) return;
    base.current = conflict.theirs.version;
    paused.current = false;
    dirty.current = true;
    setConflict(null);
    await flush();
  }, [conflict, flush]);

  /** Waits for an in-flight save, then saves anything left. Resolves true when all edits are saved. */
  const settle = useCallback(async () => {
    for (let i = 0; i < 100 && saving.current; i++) await new Promise((r) => setTimeout(r, 100));
    return flush();
  }, [flush]);

  // Offline: hold edits; on reconnect, save them.
  useEffect(() => {
    const online = () => {
      if (dirty.current && !paused.current) void flush();
      else if (!dirty.current) setStatus((s) => (s === 'offline' ? 'saved' : s));
    };
    const offline = () => {
      if (dirty.current && !paused.current) setStatus('offline');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [flush]);

  // Warn before leaving with unsaved edits; flush on tab hide.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const hide = () => {
      if (document.visibilityState === 'hidden' && dirty.current) void flush();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', hide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  return {
    status,
    error,
    conflict,
    savedAt,
    savedVersion,
    saved,
    change,
    flush,
    settle,
    adopt,
    overwrite,
    isClean: () => !dirty.current && !saving.current && !paused.current,
    current: () => ({ title: title.current, content: content.current, baseVersion: base.current }),
  };
}
