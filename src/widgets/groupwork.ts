import { communityRequest } from '../common/community-api';
import { accountScope } from '../common/account-scope';
export function mountGroupwork(container: HTMLElement): () => void {
  const scope = accountScope();
  let disposed = false;
  let revision = 0;
  const card = document.createElement('article');
  card.className = 'caspr-groupwork-widget';
  const title = document.createElement('h3');
  title.textContent = '📋 Groepswerk';
  const info = document.createElement('p');
  info.setAttribute('role', 'status');
  const list = document.createElement('div');
  list.className = 'caspr-groupwork-list';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Taken vernieuwen';
  const load = async () => {
    const version = ++revision;
    refresh.disabled = true;
    try {
      const data = await communityRequest('task-summary');
      if (disposed || version !== revision || accountScope() !== scope) return;
      list.replaceChildren();
      if (!data.ok) {
        info.textContent = 'Meld je aan bij Chats om je groepstaken te zien.';
        return;
      }
      info.textContent = data.tasks.length
        ? `${data.tasks.length} open taken · ${data.tasks.filter((t: any) => t.assigneeId === data.userId).length} voor jou`
        : 'Geen open groepstaken. Maak een taak vanuit je privégroep.';
      for (const task of data.tasks.slice(0, 6)) {
        const button = document.createElement('button');
        button.type = 'button';
        const name = document.createElement('strong');
        name.textContent = task.title;
        const detail = document.createElement('small');
        detail.textContent = `${task.groupName} · ${task.assignee || 'Niet toegewezen'}${task.deadline ? ` · ${new Date(`${task.deadline}T12:00:00`).toLocaleDateString('nl-BE')}` : ''}`;
        if (
          task.deadline &&
          !task.done &&
          task.deadline <
            new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' })
        )
          button.dataset.overdue = 'true';
        button.append(name, detail);
        button.onclick = () =>
          window.dispatchEvent(
            new CustomEvent('caspr-open-group', {
              detail: { id: task.groupId, name: task.groupName },
            }),
          );
        list.append(button);
      }
    } catch {
      if (!disposed) info.textContent = 'Taken ophalen mislukt.';
    } finally {
      if (!disposed && version === revision) refresh.disabled = false;
    }
  };
  refresh.onclick = () => void load();
  card.append(title, info, list, refresh);
  container.append(card);
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
    ++revision;
    chrome.storage.onChanged.removeListener(changed);
    card.remove();
  };
}
