'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';

/**
 * Domain services report errors in English. For other languages the app ships a table of
 * those sentences (messages/<locale>.server.json); anything missing shows in English.
 */
const Ctx = createContext<Record<string, string>>({});

export function ServerMessagesProvider({ messages, children }: { messages: Record<string, string>; children: ReactNode }) {
  return <Ctx.Provider value={messages}>{children}</Ctx.Provider>;
}

export function useServerMessage() {
  const map = useContext(Ctx);
  return useCallback(
    (message: string | undefined | null) => {
      if (!message) return '';
      return map[message] ?? message;
    },
    [map],
  );
}
