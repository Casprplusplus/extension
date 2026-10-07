export type Role = 'member' | 'dev+' | 'dev' | 'mod' | 'vip';
const labels: Record<string, string> = {
  'dev+': 'Dev+',
  dev: 'Dev',
  mod: 'Mod',
  vip: 'VIP',
};
export function levelBadge(level?: number): HTMLElement | null {
  if (!Number.isSafeInteger(level) || level! < 1) return null;
  const badge = document.createElement('span');
  badge.className = 'caspr-badge caspr-badge-level';
  badge.textContent = `Lv. ${level}`;
  badge.setAttribute('aria-label', `Level ${level}`);
  return badge;
}
export function roleBadge(role?: string): HTMLElement | null {
  if (!role || !Object.prototype.hasOwnProperty.call(labels, role)) return null;
  const badge = document.createElement('span');
  badge.className = `caspr-badge caspr-badge-${role === 'dev+' ? 'owner' : role}`;
  badge.textContent = labels[role];
  badge.setAttribute('aria-label', `Rol: ${labels[role]}`);
  return badge;
}
const rewardLabels: Record<string, string> = {
  'first-result': '🌱 Eerste resultaat',
  'ten-results': '📚 10 resultaten',
  'level-five': '⭐ Level 5',
};
export function rewardBadge(id: string): HTMLElement | null {
  if (!Object.prototype.hasOwnProperty.call(rewardLabels, id)) return null;
  const badge = document.createElement('span');
  badge.className = 'caspr-badge caspr-badge-reward';
  badge.textContent = rewardLabels[id];
  return badge;
}
