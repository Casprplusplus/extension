import { getCurrentUser, getCurrentClass, isStudentEmail } from '../common/user';
import type { InboxRoom } from '../common/community-api';

export function watchChatInbox(): () => void {
  let disposed = false;
  let port: chrome.runtime.Port | undefined;
  let rooms: InboxRoom[] = [];
  let loaded = false;
  let audio: AudioContext | undefined;
  const heard = new Set<number>();
  const render = () => {
    for (const button of document.querySelectorAll<HTMLElement>('[data-caspr-chat]')) {
      let badge = button.querySelector<HTMLElement>('.caspr-inbox-badge');
      const count = rooms.reduce((sum, r) => sum + r.unread, 0);
      const mentions = rooms.reduce((sum, r) => sum + (r.mentions || 0), 0);
      if (count && !badge) {
        badge = document.createElement('span');
        badge.className = 'caspr-inbox-badge';
        button.append(badge);
      }
      if (badge) {
        const text = `${count > 99 ? '99+' : count}${mentions ? ` · @${mentions}` : ''}`;
        if (badge.textContent !== text) badge.textContent = text;
        badge.hidden = count === 0;
      }
      button.setAttribute(
        'aria-label',
        count
          ? `Chats · ${count} ongelezen berichten${mentions ? ` · ${mentions} vermeldingen` : ''}`
          : 'Chats',
      );
    }
  };
  const beep = () => {
    try {
      audio ||= new AudioContext();
      void audio
        .resume()
        .then(() => {
          if (disposed || !audio || audio.state !== 'running') return;
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = 720;
          gain.gain.setValueAtTime(0.08, audio.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start();
          oscillator.stop(audio.currentTime + 0.2);
        })
        .catch(() => {});
    } catch {
      /* Browser may require an interaction before allowing audio. */
    }
  };
  const connect = () => {
    port?.disconnect();
    port = undefined;
    loaded = false;
    rooms = [];
    render();
    const user = getCurrentUser();
    if (!user || !isStudentEmail(user.email) || disposed) return;
    const current = chrome.runtime.connect({ name: 'global-chat' });
    port = current;
    current.onMessage.addListener((data) => {
      if (disposed || port !== current) return;
      if (data.type === 'inbox' || (data.type === 'profile-result' && data.ok)) {
        rooms = data.rooms;
        loaded = true;
        render();
      }
      if (data.type === 'auth-required') {
        rooms = [];
        render();
        current.disconnect();
        if (port === current) port = undefined;
      }
      if (data.type === 'notification' && loaded && !heard.has(data.messageId)) {
        heard.add(data.messageId);
        if (heard.size > 100) heard.delete(heard.values().next().value!);
        const preferences = rooms.find((r) => r.room === data.room);
        const open = document.querySelector<HTMLDialogElement>('.caspr-chat[open]');
        if (
          preferences?.sound &&
          !preferences.muted &&
          document.hasFocus() &&
          !(open?.dataset.room === data.room && !document.hidden)
        )
          beep();
      }
    });
    current.onDisconnect.addListener(() => {
      if (port === current) port = undefined;
    });
    current.postMessage({
      type: 'join',
      ...user,
      name: user.name.trim().slice(0, 40),
      className: getCurrentClass(),
      scope: 'global',
    });
  };
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (
      area === 'local' &&
      Object.keys(changes).some((key) => key.startsWith('chatSession:'))
    )
      connect();
  };
  chrome.storage.onChanged.addListener(changed);
  connect();
  const timer = setInterval(() => {
    render();
    if (port && loaded) port.postMessage({ type: 'profile' });
  }, 30000);
  const observer = new MutationObserver(render);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => {
    disposed = true;
    clearInterval(timer);
    observer.disconnect();
    chrome.storage.onChanged.removeListener(changed);
    port?.disconnect();
    document.querySelectorAll('.caspr-inbox-badge').forEach((b) => b.remove());
    void audio?.close();
  };
}
