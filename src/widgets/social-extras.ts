import { rewardBadge } from '../common/badges';
const el = (tag: string, text = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};
const btn = (text: string, click: () => void) => {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.onclick = click;
  return node;
};
export function appendSocialExtras(
  toolbar: HTMLElement,
  panel: HTMLElement,
  state: any,
  context: {
    room: string;
    ownId: number;
    request: (action: string, payload: unknown) => Promise<any>;
    action: (payload: unknown) => Promise<void>;
    dialog: (title: string) => HTMLDialogElement;
    report: (error: unknown) => void;
  },
) {
  const { request, action, dialog, report, room, ownId } = context;
  toolbar.append(
    btn('⌕ Zoeken', () => {
      const node = dialog('Berichten zoeken');
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.type = 'search';
      input.minLength = 2;
      input.maxLength = 100;
      input.required = true;
      input.placeholder = 'Zoek in dit gesprek';
      input.setAttribute('aria-label', 'Berichten zoeken');
      const search = document.createElement('button');
      search.type = 'submit';
      search.textContent = 'Zoeken';
      const results = el('div');
      results.className = 'caspr-message-search-results';
      const info = el('p');
      info.setAttribute('role', 'status');
      let before: number | undefined;
      let query = '';
      let epoch = 0;
      const more = btn('Meer resultaten', () => void load(true));
      more.hidden = true;
      const load = async (append = false) => {
        const version = ++epoch;
        search.disabled = more.disabled = true;
        if (!append) {
          results.replaceChildren();
          before = undefined;
          query = input.value.trim();
        }
        info.textContent = 'Zoeken…';
        try {
          const data = await request('search', {
            room,
            query,
            ...(before ? { before } : {}),
          });
          if (!node.isConnected || version !== epoch) return;
          for (const message of data.messages) {
            const row = el('article');
            row.append(
              el('strong', message.name),
              el('small', new Date(message.createdAt).toLocaleString('nl-BE')),
              el('p', message.text),
            );
            results.append(row);
          }
          before = data.nextBefore || undefined;
          more.hidden = !before;
          info.textContent = results.children.length
            ? `${results.children.length} resultaten${before ? ' · meer beschikbaar' : ''}`
            : 'Geen berichten gevonden.';
        } catch (e) {
          info.textContent = e instanceof Error ? e.message : 'Zoeken mislukt.';
        } finally {
          if (version === epoch) {
            search.disabled = more.disabled = false;
          }
        }
      };
      form.append(input, search);
      form.onsubmit = (e) => {
        e.preventDefault();
        void load();
      };
      node.append(form, info, results, more);
      input.focus();
    }),
    btn('✦ Badge kiezen', () => {
      const node = dialog('Jouw chatbadge');
      const info = el(
        'p',
        'Je rol en level blijven zichtbaar. Kies één verdiende beloningsbadge.',
      );
      const list = el('div');
      list.className = 'caspr-badge-choices';
      node.append(info, list);
      void request('badge-options', {})
        .then((data) => {
          if (!node.isConnected) return;
          for (const id of [null, ...data.progression.badges]) {
            const choose = btn('', () => {
              void request('badge-set', { badge: id })
                .then(() => node.close())
                .catch((e) => {
                  info.textContent = e.message;
                });
            });
            if (id) {
              const badge = rewardBadge(id);
              if (badge) choose.append(badge);
            } else choose.textContent = 'Geen beloningsbadge';
            choose.setAttribute('aria-pressed', String(data.selectedBadge === id));
            list.append(choose);
          }
        })
        .catch((e) => {
          info.textContent = e.message;
        });
    }),
  );
  if (!state.group) return;
  const group = state.group;
  const taskForm = (task?: any) => {
    const node = dialog(task ? 'Taak aanpassen' : 'Nieuwe groepstaak');
    const form = document.createElement('form');
    const title = document.createElement('input');
    title.required = true;
    title.maxLength = 160;
    title.value = task?.title || '';
    title.setAttribute('aria-label', 'Taak');
    const deadline = document.createElement('input');
    deadline.type = 'date';
    deadline.value = task?.deadline || '';
    deadline.setAttribute('aria-label', 'Deadline');
    const assignee = document.createElement('select');
    assignee.setAttribute('aria-label', 'Toewijzen aan');
    assignee.append(new Option('Nog niet toegewezen', ''));
    for (const member of group.members.filter((m: any) => m.accepted))
      assignee.append(new Option(member.name, String(member.id)));
    assignee.value = task?.assigneeId ? String(task.assigneeId) : '';
    for (const [labelText, input] of [
      ['Taak', title],
      ['Deadline (optioneel)', deadline],
      ['Wie doet dit?', assignee],
    ] as const) {
      const label = el('label', labelText);
      label.append(input);
      form.append(label);
    }
    const info = el('p');
    info.setAttribute('role', 'status');
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Opslaan';
    form.append(info, save);
    form.onsubmit = async (event) => {
      event.preventDefault();
      save.disabled = true;
      try {
        await action({
          action: task ? 'task-edit' : 'task-create',
          taskId: task?.id,
          title: title.value.trim(),
          deadline: deadline.value || null,
          assigneeId: assignee.value ? Number(assignee.value) : null,
        });
        node.close();
      } catch (e) {
        info.textContent = e instanceof Error ? e.message : 'Opslaan mislukt.';
      } finally {
        save.disabled = false;
      }
    };
    node.append(form);
    title.focus();
  };
  toolbar.append(btn('＋ Taak', () => taskForm()));
  const tasks = el('details');
  tasks.className = 'caspr-group-tasks';
  const rows = state.tasks || [];
  tasks.append(
    el('summary', `Groepswerk · ${rows.filter((t: any) => !t.done).length} open taken`),
  );
  if (!rows.length)
    tasks.append(el('p', 'Maak een taak, wijs iemand toe en kies een deadline.'));
  for (const task of rows) {
    const row = el('article');
    row.className = 'caspr-task-row';
    row.dataset.done = String(!!task.done);
    const toggle = btn(
      task.done ? '✓' : '○',
      () =>
        void action({ action: 'task-toggle', taskId: task.id, done: !task.done }).catch(
          report,
        ),
    );
    toggle.setAttribute(
      'aria-label',
      `${task.done ? 'Heropen' : 'Voltooi'} ${task.title}`,
    );
    const manage = group.ownerId === ownId || task.creatorId === ownId;
    toggle.disabled = !manage && task.assigneeId !== ownId;
    const body = el('div');
    body.append(
      el('strong', task.title),
      el(
        'small',
        `${task.assignee || 'Niet toegewezen'}${task.deadline ? ` · ${new Date(`${task.deadline}T12:00:00`).toLocaleDateString('nl-BE')}` : ''}`,
      ),
    );
    row.append(toggle, body);
    if (manage)
      row.append(
        btn('Bewerken', () => taskForm(task)),
        btn(
          'Verwijderen',
          () => void action({ action: 'task-delete', taskId: task.id }).catch(report),
        ),
      );
    tasks.append(row);
  }
  panel.append(tasks);
}
