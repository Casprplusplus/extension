import { communityRequest } from '../common/community-api';
export function mountMentions(input: HTMLTextAreaElement) {
  let room = '';
  let revision = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const chosen = new Map<number, string>();
  const list = document.createElement('div');
  list.className = 'caspr-mention-picker';
  list.hidden = true;
  list.setAttribute('aria-label', 'Gebruiker vermelden');
  input.parentElement!.append(list);
  const clear = () => {
    ++revision;
    clearTimeout(timeout);
    list.hidden = true;
    list.replaceChildren();
  };
  const changed = () => {
    clear();
    if (!room) return;
    const position = input.selectionStart;
    const match = /(?:^|\s)@([^@\n]{0,40})$/.exec(input.value.slice(0, position));
    if (!match) return;
    const start = position - match[1].length - 1;
    const query = match[1];
    const version = revision;
    timeout = setTimeout(() => {
      void communityRequest('mention-candidates', { room, query })
        .then((data) => {
          if (disposed || version !== revision || !data.ok) return;
          list.replaceChildren();
          for (const user of data.users) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `@${user.name}`;
            button.onclick = () => {
              input.value =
                input.value.slice(0, start) +
                `@${user.name} ` +
                input.value.slice(position);
              chosen.set(user.id, user.name);
              const end = start + user.name.length + 2;
              input.focus();
              input.setSelectionRange(end, end);
              clear();
              input.dispatchEvent(new Event('input', { bubbles: true }));
            };
            list.append(button);
          }
          list.hidden = !data.users.length;
        })
        .catch(() => {});
    }, 180);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') clear();
    if (event.key === 'ArrowDown' && !list.hidden) {
      event.preventDefault();
      list.querySelector('button')?.focus();
    }
  };
  input.addEventListener('input', changed);
  input.addEventListener('keydown', keydown);
  return {
    setRoom(value: string) {
      if (room !== value) {
        room = value;
        chosen.clear();
        clear();
      }
    },
    ids() {
      return [...chosen]
        .filter(([, name]) => input.value.includes(`@${name}`))
        .map(([id]) => id);
    },
    reset() {
      chosen.clear();
      clear();
    },
    cleanup() {
      disposed = true;
      clear();
      input.removeEventListener('input', changed);
      input.removeEventListener('keydown', keydown);
      list.remove();
    },
  };
}
