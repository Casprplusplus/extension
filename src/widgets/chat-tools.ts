import type { InboxRoom } from '../common/community-api';
export function mountChatTools(
  parent: HTMLElement,
  input: HTMLTextAreaElement,
  getPort: () => chrome.runtime.Port | undefined,
) {
  let room = '';
  let muted = false;
  let sound = false;
  let saving = false;
  let error = '';
  const typing = new Map<number, { name: string; until: number }>();
  const tools = document.createElement('div');
  tools.className = 'caspr-chat-tools';
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.textContent = 'Chat dempen';
  const soundLabel = document.createElement('label');
  soundLabel.className = 'caspr-chat-sound-toggle';
  const soundInput = document.createElement('input');
  soundInput.type = 'checkbox';
  soundLabel.append(soundInput, document.createTextNode(' Meldingsgeluid'));
  const info = document.createElement('p');
  info.setAttribute('role', 'status');
  const line = document.createElement('p');
  line.className = 'caspr-chat-typing';
  line.setAttribute('aria-live', 'polite');
  tools.append(mute, soundLabel, info);
  parent.append(tools, line);
  const render = () => {
    mute.textContent = muted ? 'Chat weer aanzetten' : 'Chat dempen';
    mute.setAttribute('aria-pressed', String(muted));
    soundInput.checked = sound;
    mute.disabled = soundInput.disabled = saving || !room;
    info.textContent =
      error || (muted ? 'Gedempt: badges blijven zichtbaar, geluid staat stil.' : '');
    for (const [id, value] of typing) if (value.until < Date.now()) typing.delete(id);
    line.textContent = typing.size
      ? `${[...typing.values()]
          .map((v) => v.name)
          .slice(0, 3)
          .join(', ')} ${typing.size === 1 ? 'typt' : 'typen'}…`
      : '';
  };
  const save = () => {
    error = '';
    const port = getPort();
    if (!port) {
      saving = false;
      error = 'Niet verbonden.';
      render();
      return;
    }
    saving = true;
    render();
    port.postMessage({ type: 'preferences', muted, sound });
  };
  mute.onclick = () => {
    muted = !muted;
    save();
  };
  soundInput.onchange = () => {
    sound = soundInput.checked;
    save();
  };
  const inputChanged = () =>
    getPort()?.postMessage({ type: 'typing', active: !!input.value.trim() });
  input.addEventListener('input', inputChanged);
  const timer = setInterval(render, 1000);
  render();
  return {
    receive(data: any) {
      if (data.type === 'profile-result' && data.ok) room = data.room || '';
      if ((data.type === 'inbox' || data.type === 'profile-result') && data.rooms) {
        const state = (data.rooms as InboxRoom[]).find((r) => r.room === room);
        if (state) {
          muted = state.muted;
          sound = state.sound;
        }
      }
      if (data.type === 'preferences-result') {
        saving = false;
        if (!data.ok) {
          error = data.error || 'Opslaan mislukt.';
          getPort()?.postMessage({ type: 'profile' });
          render();
          return;
        }
        error = '';
        muted = !!data.state.muted;
        sound = !!data.state.sound;
      }
      if (data.type === 'typing') {
        if (data.active)
          typing.set(data.userId, { name: data.name, until: Date.now() + 5000 });
        else typing.delete(data.userId);
      }
      render();
    },
    reset() {
      room = '';
      saving = false;
      error = '';
      typing.clear();
      render();
    },
    cleanup() {
      clearInterval(timer);
      input.removeEventListener('input', inputChanged);
      tools.remove();
      line.remove();
    },
  };
}
