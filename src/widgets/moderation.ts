import { communityRequest } from '../common/community-api';
export function mountModeration(sidebar: HTMLElement) {
  let disposed = false;
  const dialogs = new Set<HTMLDialogElement>();
  const node = (tag: string, text = '') => {
    const value = document.createElement(tag);
    value.textContent = text;
    return value;
  };
  const button = (text: string, action: () => void) => {
    const value = document.createElement('button');
    value.type = 'button';
    value.textContent = text;
    value.onclick = action;
    return value;
  };
  const dialog = (title: string) => {
    const value = document.createElement('dialog');
    value.className = 'caspr-community caspr-social-dialog caspr-report-dialog';
    value.setAttribute('aria-label', title);
    const header = node('header');
    header.append(
      node('h2', title),
      button('Sluiten', () => value.close()),
    );
    value.append(header);
    document.body.append(value);
    dialogs.add(value);
    value.addEventListener('close', () => {
      dialogs.delete(value);
      value.remove();
    });
    value.showModal();
    return value;
  };
  const request = async (action: string, payload: unknown) => {
    const result = await communityRequest(action, payload);
    if (!result.ok) throw new Error(result.error || 'Aanvraag mislukt.');
    return result;
  };
  const overview = button('⚑ Meldingen bekijken', () => {
    const value = dialog('Mod · Berichtmeldingen');
    const tabs = node('div');
    tabs.className = 'caspr-social-toolbar';
    const list = node('div');
    const info = node('p');
    info.setAttribute('role', 'status');
    let closed = false;
    let before: number | undefined;
    let epoch = 0;
    const more = button('Meer meldingen', () => void load(true));
    more.hidden = true;
    const load = async (append = false) => {
      const version = ++epoch;
      if (!append) {
        before = undefined;
        list.replaceChildren();
      }
      more.disabled = true;
      info.textContent = 'Meldingen laden…';
      try {
        const data = await request('reports', {
          closed,
          ...(before ? { before } : {}),
        });
        if (disposed || !value.isConnected || version !== epoch) return;
        for (const report of data.reports) {
          const row = node('article');
          row.className = 'caspr-report-row';
          const kind =
            report.room === 'global'
              ? 'Globale chat'
              : report.room.startsWith('class:')
                ? 'Klaschat'
                : 'Privébericht · gedeeld door melder';
          row.append(
            node(
              'small',
              `${kind} · ${new Date(report.createdAt).toLocaleString('nl-BE')}`,
            ),
            node('strong', report.author),
            node('blockquote', report.text || 'GIF'),
            node('p', `Reden: ${report.reason}`),
            node('small', `Gemeld door ${report.reporter}`),
          );
          if (report.gifUrl) row.append(node('small', 'Dit bericht bevat een GIF.'));
          if (closed)
            row.append(
              node(
                'p',
                report.resolution === 'remove' ? 'Bericht verwijderd' : 'Afgehandeld',
              ),
            );
          else
            for (const [action, label] of [
              ['dismiss', 'Afhandelen'],
              ...(report.room === 'global' || report.room.startsWith('class:')
                ? [['remove', 'Bericht verwijderen']]
                : []),
            ] as string[][]) {
              const control = button(label, () => {
                control.disabled = true;
                void request('report-resolve', { reportId: report.id, action })
                  .then(() => load())
                  .catch((e) => {
                    info.textContent = e.message;
                    control.disabled = false;
                  });
              });
              row.append(control);
            }
          list.append(row);
        }
        before = data.nextBefore || undefined;
        more.hidden = !before;
        info.textContent = list.children.length
          ? `${list.children.length} meldingen`
          : 'Geen meldingen.';
      } catch (e) {
        if (version === epoch)
          info.textContent = e instanceof Error ? e.message : 'Ophalen mislukt.';
      } finally {
        if (version === epoch) more.disabled = false;
      }
    };
    const active = button('Open', () => {
      closed = false;
      active.setAttribute('aria-pressed', 'true');
      archive.setAttribute('aria-pressed', 'false');
      void load();
    });
    const archive = button('Afgehandeld', () => {
      closed = true;
      active.setAttribute('aria-pressed', 'false');
      archive.setAttribute('aria-pressed', 'true');
      void load();
    });
    active.setAttribute('aria-pressed', 'true');
    tabs.append(active, archive);
    value.append(tabs, info, list, more);
    void load();
  });
  overview.hidden = true;
  sidebar.append(overview);
  return {
    setRole(role: string) {
      overview.hidden = !['mod', 'dev+'].includes(role);
      if (overview.hidden)
        for (const value of dialogs)
          if (value.getAttribute('aria-label') === 'Mod · Berichtmeldingen')
            value.close();
    },
    report(room: string, messageId: number) {
      const value = dialog('Bericht rapporteren');
      const form = document.createElement('form');
      const label = node('label', 'Waarom meld je dit bericht?');
      const reason = document.createElement('textarea');
      reason.required = true;
      reason.maxLength = 500;
      reason.rows = 3;
      label.append(reason);
      const note = node(
        'p',
        'De melding deelt dit bericht en jouw naam met Mod en Dev+. Bij een privégesprek delen we alleen het gemelde bericht.',
      );
      const info = node('p');
      info.setAttribute('role', 'status');
      const send = document.createElement('button');
      send.type = 'submit';
      send.textContent = 'Melding versturen';
      form.append(note, label, info, send);
      value.append(form);
      form.onsubmit = async (event) => {
        event.preventDefault();
        send.disabled = true;
        try {
          await request('report-message', {
            room,
            messageId,
            reason: reason.value.trim(),
          });
          form.replaceChildren(node('p', 'Bedankt. Je melding is verstuurd.'));
        } catch (e) {
          info.textContent = e instanceof Error ? e.message : 'Melden mislukt.';
          send.disabled = false;
        }
      };
      reason.focus();
    },
    cleanup() {
      disposed = true;
      for (const value of dialogs) value.close();
      overview.remove();
    },
  };
}
