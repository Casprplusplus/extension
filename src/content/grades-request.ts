import { accountScope } from '../common/account-scope';
import { parseGradesResponse } from '../common/grades-response';
import type { Grade } from '../common/grades';

export interface GradeResult {
  grades: Grade[];
  updated: number;
}

let pending: Promise<GradeResult> | undefined;
let pendingScope = '';
let controller: AbortController | undefined;

export function cancelGradesRequest(): void {
  controller?.abort();
}

export function requestGrades(): Promise<GradeResult> {
  const scope = accountScope();

  if (location.origin !== 'https://kolvw.caspr.be' || !scope)
    return Promise.reject(new Error('Meld je aan bij CASPR om punten op te halen.'));
  if (pending && pendingScope === scope && !controller?.signal.aborted) return pending;

  controller?.abort();

  const current = new AbortController();
  controller = current;
  pendingScope = scope;

  const timeout = setTimeout(() => current.abort(), 15000);

  const operation = (async () => {
    const response = await fetch('/LeerlingApp/PuntenboekGet?vakID=', {
      method: 'GET',
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: current.signal,
      headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
    });

    if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Punten ophalen mislukt. Controleer je CASPR-sessie.');
    const grades = parseGradesResponse(await response.text());

    if (current.signal.aborted || accountScope() !== scope)
      throw new Error('Puntenaanvraag geannuleerd.');
    return { grades, updated: Date.now() };
  })();

  pending = operation;

  void operation
    .finally(() => {
      clearTimeout(timeout);

      if (pending === operation) {
        pending = undefined;
        controller = undefined;
      }
    })
    .catch(() => {});

  return operation;
}
