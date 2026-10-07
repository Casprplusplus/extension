import {
  defaults,
  parseSettings,
  loginSplashes,
  type ThemeSettings,
} from '../common/themes';
import { renderSplashText } from '../common/splash-text';
import { getCurrentUser, isStudentEmail } from '../common/user';

function apply(settings: ThemeSettings): void {
  const password = document.querySelector<HTMLInputElement>('#Password');
  const login = password?.closest('form');
  const microsoft = document.querySelector<HTMLFormElement>(
    'form[action="/Auth/ExternalLogin"]',
  );

  const root = document.documentElement;
  const username = login?.querySelector<HTMLInputElement>(
    '#Username, #UserName, #Email, input[type="email"], input[name="UserName"], input[name="Username"], input[name="Email"]',
  );
  const email = getCurrentUser()?.email || username?.value;

  if (!login || !settings.enabled || !isStudentEmail(email)) {
    root.removeAttribute('data-caspr-theme');

    document.getElementById('caspr-splash')?.remove();
    document
      .querySelectorAll('.caspr-login-form')
      .forEach((e) => e.classList.remove('caspr-login-form'));

    return;
  }

  root.dataset.casprTheme = settings.theme;
  login.classList.add('caspr-login-form');
  microsoft?.classList.add('caspr-login-form');

  let splash = document.getElementById('caspr-splash');
  if (!settings.splash) {
    splash?.remove();
    return;
  }

  if (!splash) {
    splash = document.createElement('div');
    splash.id = 'caspr-splash';

    const heading = document.createElement('h1');
    heading.textContent = 'Welkom terug.';

    const line = document.createElement('p');
    line.className = 'caspr-pixel-splash';

    renderSplashText(
      line,
      loginSplashes[Math.floor(Math.random() * loginSplashes.length)],
    );

    splash.append(heading, line);
    login.before(splash);
  }
}

let settings: ThemeSettings = defaults;
let revision = 0;
document.addEventListener('input', () => apply(settings));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.loginTheme) {
    revision++;
    settings = parseSettings(changes.loginTheme.newValue);

    apply(settings);
  }
});

const initialRevision = revision;

chrome.storage.local
  .get('loginTheme')
  .then((data) => {
    if (revision === initialRevision) settings = parseSettings(data.loginTheme);

    apply(settings);
  })
  .catch(() => apply(settings));
