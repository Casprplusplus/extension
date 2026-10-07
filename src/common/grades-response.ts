import { parseScore, type Grade } from './grades';

export function parseGradesResponse(html: string): Grade[] {
  if (html.length > 3000000) throw new Error('Puntenboekantwoord te groot');

  const template = document.createElement('template');
  template.innerHTML = html;

  const root = template.content;
  if (!root.querySelector('[id="VakID_0"]'))
    throw new Error('Geen geldig puntenboekantwoord; meld opnieuw aan bij CASPR');

  const grades: Grade[] = [];
  const tables = root.querySelectorAll<HTMLTableElement>('table.puntenboekLeerling');

  if (!tables.length) throw new Error('Onverwachte puntenboekstructuur');

  for (const table of tables) {
    let sibling = table.parentElement?.previousElementSibling;

    while (sibling && sibling.tagName !== 'H3') sibling = sibling.previousElementSibling;

    const subject = sibling?.textContent?.trim();
    if (!subject) throw new Error('Vaknaam ontbreekt in puntenboekantwoord');

    for (const row of table.querySelectorAll<HTMLTableRowElement>(
      'tbody > tr.IsRapportPunt',
    )) {
      if (row.classList.contains('IsGeenRapportPunt')) continue;

      const scoreCell = [...row.children].find((cell) =>
        cell.classList.contains('text-right'),
      );

      const score = parseScore(scoreCell?.textContent || '');
      if (score) {
        // Identity excludes the score, so a correction updates the same award.
        const apiId = row.getAttribute('data-punt-id') || row.getAttribute('data-id');
        const identityCells = [...row.children]
          .filter((cell) => cell !== scoreCell && !cell.querySelector('button, input, a'))
          .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')
          .filter(Boolean);
        const dated = identityCells.some((text) =>
          /\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?/.test(text),
        );
        const xpSource = apiId
          ? `id:${apiId}`
          : dated && identityCells.length >= 2
            ? `row:${JSON.stringify(identityCells)}`
            : '';
        grades.push({
          subject: subject.slice(0, 100),
          ...score,
          ...(xpSource ? { xpSource: `${subject.normalize('NFKC')}:${xpSource}` } : {}),
        });
      }
    }
  }

  return grades;
}
