import { communityRequest } from '../common/community-api';
import { roleBadge } from '../common/badges';

export function mountRoleManager(sidebar: HTMLElement): {
  setRole: (role: string) => void;
  cleanup: () => void;
} {
  let disposed = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '⚙ Rollen beheren';
  button.hidden = true;
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community caspr-role-manager';
  dialog.setAttribute('aria-label', 'Dev+ rollenbeheer');
  const title = document.createElement('h2');
  title.textContent = 'Dev+ · Rollen beheren';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Sluiten';
  close.onclick = () => dialog.close();
  const header = document.createElement('header');
  header.append(title, close);
  const note = document.createElement('p');
  note.textContent =
    'Mod kan openbare chatberichten verwijderen. Dev en VIP zijn cosmetische badges. Dev+ kan ook rollen beheren.';
  const searchForm = document.createElement('form');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Zoek op naam';
  search.setAttribute('aria-label', 'Gebruiker zoeken');
  search.maxLength = 80;
  const searchButton = document.createElement('button');
  searchButton.textContent = 'Zoeken';
  searchForm.append(search, searchButton);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const list = document.createElement('div');
  list.className = 'caspr-role-list';
  dialog.append(header, note, searchForm, status, list);
  document.body.append(dialog);
  sidebar.append(button);
  const load = async () => {
    status.textContent = 'Gebruikers ophalen…';
    const result = await communityRequest('roles', { query: search.value }).catch(() => ({
      ok: false,
      error: 'Ophalen mislukt.',
    }));
    if (disposed) return;
    if (!result.ok) {
      status.textContent = result.error;
      list.replaceChildren();
      return;
    }
    status.textContent = `${result.users.length} gebruikers${result.users.length === 200 ? ' · verfijn je zoekopdracht' : ''}`;
    list.replaceChildren();
    for (const user of result.users) {
      const row = document.createElement('div');
      row.className = 'caspr-role-row';
      const name = document.createElement('strong');
      name.textContent = `${user.name} · ${user.className}`;
      row.append(name);
      const badge = roleBadge(user.role);
      if (badge) row.append(badge);
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Rol van ${user.name}`);
      for (const [value, label] of [
        ['member', 'Leerling'],
        ['vip', 'VIP'],
        ['dev', 'Dev'],
        ['mod', 'Mod'],
        ['dev+', 'Dev+'],
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = user.role;
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'Opslaan';
      save.onclick = async () => {
        save.disabled = true;
        try {
          const result = await communityRequest('role-set', {
            targetId: user.id,
            role: select.value,
          });
          if (disposed) return;
          if (!result.ok) {
            status.textContent = result.error;
            save.disabled = false;
            return;
          }
          await load();
        } catch {
          if (!disposed) {
            status.textContent = 'Opslaan mislukt.';
            save.disabled = false;
          }
        }
      };
      row.append(select, save);
      list.append(row);
    }
  };
  searchForm.onsubmit = (event) => {
    event.preventDefault();
    void load();
  };
  button.onclick = () => {
    dialog.showModal();
    void load();
  };
  return {
    setRole: (role) => {
      button.hidden = role !== 'dev+';
      if (button.hidden && dialog.open) dialog.close();
    },
    cleanup: () => {
      disposed = true;
      button.remove();
      dialog.remove();
    },
  };
}
