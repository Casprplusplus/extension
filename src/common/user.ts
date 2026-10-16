export interface CasprUser {
  name: string;
  email: string;
}

type UserRoot = Pick<Document, 'querySelector'>;

export function getCurrentClass(
  root: Pick<Document, 'querySelectorAll'> = document,
): string {
  for (const element of root.querySelectorAll('.main-content h6, .main-content p')) {
    const match = element.textContent?.match(/Huidige\s+klas\s*:\s*([^\n(]+)/i);
    if (match) return match[1].replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  return '';
}

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function getCurrentUser(root: UserRoot = document): CasprUser | null {
  const account = root.querySelector('.account-item > .content > a.js-acc-btn');
  const text = account?.textContent || '';

  const email =
    text.match(emailPattern)?.[0] ||
    root.querySelector('.header-desktop')?.textContent?.match(emailPattern)?.[0];
  if (!email) return null;

  const name = text.replace(emailPattern, '').replace(/\s+/g, ' ').trim();
  return { name, email: email.toLowerCase() };
}

export function isCurrentUser(email: string, root: UserRoot = document): boolean {
  const user = getCurrentUser(root);
  return user !== null && user.email === email.trim().toLowerCase();
}
export function watchAccount(changed: () => void): () => void {
  let previous: string | undefined;
  const check = () => {
    const user = getCurrentUser();
    const current = user?.email || '';
    if (current !== previous) {
      previous = current;
      changed();
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  check();
  return () => observer.disconnect();
}

export function isEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

export function isStudentEmail(email: unknown): email is string {
  return isEmail(email) && /^ll/i.test(email.trim());
}
