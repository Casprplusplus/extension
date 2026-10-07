import { communityRequest, type Progression } from '../common/community-api';
import { rewardBadge } from '../common/badges';
import { gradeAwards } from '../common/progression';
import { requestGrades } from '../content/grades-request';
import { accountScope } from '../common/account-scope';

export function mountProgression(container: HTMLElement): () => void {
  let disposed = false;
  const scope = accountScope();
  const article = document.createElement('article');
  article.className = 'caspr-progression';
  const title = document.createElement('h3');
  title.textContent = '✨ Jouw voortgang';
  const level = document.createElement('strong');
  level.className = 'caspr-progression-level';
  const detail = document.createElement('p');
  const bar = document.createElement('progress');
  bar.setAttribute('aria-label', 'XP naar volgend level');
  const badges = document.createElement('div');
  badges.className = 'caspr-reward-badges';
  const note = document.createElement('p');
  note.textContent =
    'Een speelse beloning voor je resultaten: 10–100 XP per resultaat. Dit verandert je schoolpunten niet.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'XP bijwerken';
  const render = (data: Progression) => {
    level.textContent = `Level ${data.level}`;
    detail.textContent = `${data.xp} XP · nog ${data.nextLevel - data.xp} XP tot level ${data.level + 1}`;
    bar.max = data.nextLevel - data.levelStart;
    bar.value = data.xp - data.levelStart;
    badges.replaceChildren(
      ...data.badges.map(rewardBadge).filter((b): b is HTMLElement => !!b),
    );
  };
  const load = async () => {
    if (refresh.disabled || disposed) return;
    refresh.disabled = true;
    status.textContent = 'Voortgang ophalen…';
    try {
      const profile = await communityRequest('profile');
      if (disposed || accountScope() !== scope) return;
      if (!profile.ok) {
        status.textContent = profile.error;
        return;
      }
      render(profile.progression);
      const result = await requestGrades();
      if (disposed || accountScope() !== scope) return;
      const awards = await gradeAwards(result.grades);
      let current = profile.progression;
      for (let i = 0; i < awards.length; i += 40) {
        if (disposed || accountScope() !== scope) return;
        const update = await communityRequest('xp', { awards: awards.slice(i, i + 40) });
        if (!update.ok) throw new Error(update.error);
        current = update.progression;
      }
      if (disposed || accountScope() !== scope) return;
      render(current);
      const skipped = result.grades.filter((g) => !g.xpSource).length;
      status.textContent = `Bijgewerkt · ${awards.length} herkenbare resultaten${skipped ? ` · ${skipped} resultaten zonder vaste herkenning overgeslagen` : ''}. Opnieuw ophalen telt niet dubbel.`;
    } catch (error) {
      if (!disposed)
        status.textContent =
          error instanceof Error ? error.message : 'XP ophalen mislukt.';
    } finally {
      if (!disposed) refresh.disabled = false;
    }
  };
  refresh.onclick = () => void load();
  article.append(title, level, detail, bar, badges, note, status, refresh);
  container.append(article);
  void load();
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (
      area === 'local' &&
      Object.keys(changes).some((k) => k.startsWith('chatSession:'))
    )
      void load();
  };
  chrome.storage.onChanged.addListener(changed);
  return () => {
    disposed = true;
    chrome.storage.onChanged.removeListener(changed);
    article.remove();
  };
}
