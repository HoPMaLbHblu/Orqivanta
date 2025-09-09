'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type RealtimeChange = { channel: string; type: string; entityId: string | null; payload: Record<string, unknown> };
type Status = 'connecting' | 'live' | 'offline';

const Ctx = createContext<{ status: Status; subscribe: (fn: (e: RealtimeChange) => void) => () => void }>({ status: 'connecting', subscribe: () => () => {} });

/**
 * Keeps one event stream open for the organization. Any change refreshes the server-rendered
 * page (debounced), so lists, counts and detail views stay current in every open tab.
 * EventSource reconnects on its own and sends Last-Event-ID, so missed events are replayed.
 */
export function RealtimeProvider({ org, children }: { org: string; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('connecting');
  const listeners = useRef(new Set<(e: RealtimeChange) => void>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/realtime/${org}`);
    es.onopen = () => setStatus('live');
    es.onerror = () => setStatus(navigator.onLine ? 'connecting' : 'offline');
    const onChange = (ev: MessageEvent) => {
      let data: RealtimeChange;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      for (const fn of listeners.current) fn(data);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    es.addEventListener('change', onChange as EventListener);
    es.addEventListener('reset', () => router.refresh());
    const offline = () => setStatus('offline');
    const online = () => setStatus('connecting');
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      es.close();
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [org, router]);

  const subscribe = useCallback((fn: (e: RealtimeChange) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  return useContext(Ctx);
}

export function useRealtimeEvent(fn: (e: RealtimeChange) => void) {
  const { subscribe } = useRealtime();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe]);
}
