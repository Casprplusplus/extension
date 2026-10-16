import { emoji } from '../common/emoji';
export function mountNavbarActions(focus = false): () => void {
  const nodes: HTMLElement[] = [];
  for (const list of document.querySelectorAll<HTMLElement>(
    '.navbar-sidebar .navbar__list, .navbar-mobile .navbar__list',
  )) {
    for (const [label, icon, selector] of [
      ['Chats', '💬', '[data-caspr-chat]'],
      ['Games', '🎮', '.caspr-game-column button, [data-caspr-games]'],
      ['Instellingen', '⚙️', '[data-caspr-settings]'],
    ]) {
      if (focus && (label === 'Chats' || label === 'Games')) continue;
      const item = document.createElement('li');
      item.className = 'caspr-navbar-action';
      const button = document.createElement('a');
      const id =
        'caspr:' +
        (label === 'Chats' ? 'chats' : label === 'Games' ? 'games' : 'settings');
      button.href = '#' + id;
      button.dataset.casprNavId = id;
      button.dataset.casprNavIcon = 'true';
      button.setAttribute('aria-haspopup', 'dialog');
      button.append(emoji(icon, 'caspr-nav-emoji'), document.createTextNode(label));
      if (label === 'Chats') button.dataset.casprChatNav = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(selector)?.click();
      });
      item.append(button);
      list.append(item);
      nodes.push(item);
    }
  }
  return () => nodes.forEach((node) => node.remove());
}
