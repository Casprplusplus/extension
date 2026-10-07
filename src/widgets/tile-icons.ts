import { emoji } from '../common/emoji';
const icons: Record<string, string> = {
  dashboard: '🏠',
  rapport: '📊',
  puntenboek: '📚',
  leerlingvolgsysteem: '🗂️',
  leerenleef: '🌟',
  berichten: '💬',
  uurrooster: '🕒',
  afwezigheden: '🩹',
  agenda: '📅',
  vervangingen: '🔄',
  externelink: '🔗',
  oudercontacten: '🤝',
  teams: '🎥',
  broodjesbestelling: '🥪',
};

function linkIcon(link: HTMLAnchorElement): string | undefined {
  const parts = new URL(link.href, location.href).pathname
    .toLowerCase()
    .split('/')
    .filter(Boolean);
  const route = parts[parts.length - 1];

  if (icons[route]) return icons[route];
  if (route === 'leerlingapp') return icons.dashboard;

  const label = (link.textContent || '').toLowerCase().replace(/[^a-z]/g, '');

  const aliases: Record<string, string> = {
    leerleef: 'leerenleef',
    broodje: 'broodjesbestelling',
    home: 'dashboard',
    start: 'dashboard',
  };

  return icons[aliases[label] || label];
}

export function decorateNavigation(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '.navbar-sidebar a, .navbar-mobile a',
  )) {
    if (link.querySelector('.caspr-nav-emoji')) continue;

    const icon = linkIcon(link);
    if (!icon) continue;

    link.prepend(emoji(icon, 'caspr-nav-emoji'));
    link.dataset.casprNavIcon = 'true';
  }
}

export function decorateTiles(tiles: HTMLAnchorElement[]): void {
  for (const tile of tiles) {
    if (tile.querySelector('.caspr-tile-emoji')) continue;

    const icon = linkIcon(tile);
    if (icon) tile.prepend(emoji(icon, 'caspr-tile-emoji'));
  }
}
