import { BACKEND_URL } from './backend';

export type Draft = { text: string; gifUrl: string };
export function createChatLocal(email: string) {
  const prefix = `chatLocal:${BACKEND_URL}:${email.trim().toLowerCase()}:`;
  const drafts = new Map<string, Draft>();
  const favorites = new Set<string>();
  const listeners = new Set<() => void>();
  let loaded = false;
  let writes = Promise.resolve();
  const storage = chrome.storage?.local;
  const write = (key: string, value: unknown) => {
    writes = writes
      .then(async () => {
        if (value === null) await storage?.remove(key);
        else await storage?.set({ [key]: value });
      })
      .catch(() => {});
  };
  const ready = (async () => {
    try {
      const key = `${prefix}favorites`;
      const data = await storage?.get(key);
      if (Array.isArray(data?.[key]))
        for (const room of data[key]) if (typeof room === 'string') favorites.add(room);
    } catch {}
    loaded = true;
    listeners.forEach((listener) => listener());
  })();
  const toggle = (room: string) => {
    if (!loaded) {
      void ready.then(() => toggle(room));
      return;
    }
    if (favorites.has(room)) favorites.delete(room);
    else favorites.add(room);
    write(`${prefix}favorites`, [...favorites]);
    listeners.forEach((listener) => listener());
  };
  return {
    ready,
    favorite: (room: string) => favorites.has(room),
    toggle,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async draft(room: string): Promise<Draft> {
      if (drafts.has(room)) return drafts.get(room)!;
      try {
        const key = `${prefix}draft:${room}`;
        const data = await storage?.get(key);
        if (drafts.has(room)) return drafts.get(room)!;
        const raw = data?.[key];
        const value =
          raw && typeof raw === 'object' ? (raw as Partial<Draft>) : undefined;
        const draft = {
          text: typeof value?.text === 'string' ? value.text.slice(0, 2000) : '',
          gifUrl: typeof value?.gifUrl === 'string' ? value.gifUrl : '',
        };
        drafts.set(room, draft);
        return draft;
      } catch {
        return { text: '', gifUrl: '' };
      }
    },
    saveDraft(room: string, draft: Draft) {
      const value = { text: draft.text.slice(0, 2000), gifUrl: draft.gifUrl };
      drafts.set(room, value);
      write(`${prefix}draft:${room}`, value.text || value.gifUrl ? value : null);
    },
    flush: () => writes,
  };
}
export type ChatLocal = ReturnType<typeof createChatLocal>;
