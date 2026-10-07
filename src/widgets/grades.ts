import { summarizeGrades } from '../common/grades';
import { requestGrades, cancelGradesRequest } from '../content/grades-request';

export function mountGrades(content: HTMLElement): () => void {
  const panel = document.createElement('details');
  panel.className = 'caspr-grades-overview';
  panel.setAttribute('aria-label', 'Puntenoverzicht');

  const summary = document.createElement('summary');
  const title = document.createElement('span');
  title.className = 'caspr-grades-title';
  title.textContent = '📊 Jouw puntenoverzicht';

  const hint = document.createElement('span');
  hint.className = 'caspr-grades-hint';
  hint.textContent = 'Bekijk je resultaten';
  summary.append(title, hint);

  const expanded = document.createElement('div');
  expanded.className = 'caspr-grades-content';

  const note = document.createElement('p');
  note.textContent =
    'Rechtstreeks uit CASPR. Alleen rapportpunten: som behaalde punten / som maximum. CASPR kan andere rapportwegingen gebruiken.';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');

  const body = document.createElement('div');
  body.className = 'caspr-grades-grid';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'caspr-refresh-schedule';
  refresh.textContent = 'Punten vernieuwen';

  const link = document.createElement('a');
  link.href = '/leerlingapp/Puntenboek';
  link.textContent = 'Puntenboek openen';

  const actions = document.createElement('div');
  actions.className = 'caspr-grades-actions';
  actions.append(refresh);

  if (location.pathname.toLowerCase().replace(/\/$/, '') !== '/leerlingapp/puntenboek')
    actions.append(link);
  expanded.append(note, status, body, actions);
  panel.append(summary, expanded);

  content.prepend(panel);

  let disposed = false;

  const load = async () => {
    if (disposed || refresh.disabled) return;

    refresh.disabled = true;
    status.textContent = 'Punten ophalen bij CASPR…';

    try {
      const result = await requestGrades();
      if (disposed) return;

      const summaries = summarizeGrades(result.grades);
      hint.textContent = summaries.length
        ? `${summaries.length} vakken · ${result.grades.length} resultaten`
        : 'Nog geen resultaten';

      body.replaceChildren();
      if (!summaries.length)
        body.textContent = 'CASPR heeft nog geen numerieke rapportpunten beschikbaar.';

      for (const item of summaries) {
        const row = document.createElement('div');
        row.className = 'caspr-grade-row';

        const subject = document.createElement('strong');
        subject.textContent = item.subject;

        const score = document.createElement('span');
        score.className = 'caspr-grade-score';
        score.textContent = `${item.percentage.toFixed(1).replace('.', ',')}%`;

        const count = document.createElement('small');
        count.textContent = `${item.count} ${item.count === 1 ? 'resultaat' : 'resultaten'}`;

        const bar = document.createElement('progress');
        bar.max = 100;
        bar.value = item.percentage;

        bar.setAttribute(
          'aria-label',
          `${item.subject}: ${item.percentage.toFixed(1)} procent`,
        );

        row.dataset.shortfall = String(item.percentage < 50);

        row.append(subject, score, bar, count);
        body.append(row);
      }

      status.textContent = `Bijgewerkt om ${new Date(result.updated).toLocaleTimeString('nl-BE')}. Punten worden niet opgeslagen in de extensie.`;
    } catch (error) {
      if (!disposed && !body.children.length)
        hint.textContent = 'Ophalen mislukt · open voor details';
      if (!disposed)
        status.textContent = `${error instanceof Error ? error.message : 'Punten ophalen mislukt.'}${body.children.length ? ' De eerder opgehaalde waarden staan nog in dit venster.' : ''}`;
    } finally {
      if (!disposed) refresh.disabled = false;
    }
  };

  refresh.addEventListener('click', () => void load());

  void load();
  void chrome.storage.local.remove('gradeCache').catch(() => {});

  const cleanup = () => {
    disposed = true;
    cancelGradesRequest();
    panel.remove();
    window.removeEventListener('pagehide', cleanup);
  };

  window.addEventListener('pagehide', cleanup, { once: true });

  return cleanup;
}
