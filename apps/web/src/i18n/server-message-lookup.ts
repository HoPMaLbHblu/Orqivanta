/**
 * Looks up the translation of an English domain message. Exact sentences match first; keys
 * with {placeholders} then match messages built from a template, such as notification
 * titles ("Review requested: {title}"). Captured values are themselves looked up, so
 * "{what} doesn’t exist…" can translate "That task" as well.
 */
export type ServerMessageMap = Record<string, string>;

const patternCache = new WeakMap<ServerMessageMap, { re: RegExp; names: string[]; value: string }[]>();

function patterns(map: ServerMessageMap) {
  let list = patternCache.get(map);
  if (!list) {
    list = Object.entries(map)
      .filter(([k]) => /\{\w+\}/.test(k))
      .map(([k, value]) => {
        const names: string[] = [];
        const source = k
          .split(/(\{\w+\})/)
          .map((part) => {
            const m = /^\{(\w+)\}$/.exec(part);
            if (m) {
              names.push(m[1]!);
              return '(.+?)';
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('');
        return { re: new RegExp(`^${source}$`, 's'), names, value };
      });
    patternCache.set(map, list);
  }
  return list;
}

export function lookupServerMessage(map: ServerMessageMap, message: string): string {
  const exact = map[message];
  if (exact !== undefined) return exact;
  for (const p of patterns(map)) {
    const m = p.re.exec(message);
    if (!m) continue;
    return p.names.reduce((out, name, i) => {
      const captured = m[i + 1] ?? '';
      return out.replace(`{${name}}`, map[captured] ?? captured);
    }, p.value);
  }
  return message;
}
