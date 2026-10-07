import { getCurrentUser, getCurrentClass } from '../common/user';
export function mountChatAccount(
  host: HTMLElement,
  sidebar: HTMLElement,
  reconnect: () => void,
  disconnect: () => void,
) {
  let disposed = false;
  let mode: 'login' | 'activate' | 'reset' = 'login';
  let busy = false;
  let cooldown = false;
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  const panel = document.createElement('section');
  panel.className = 'caspr-chat-auth';
  panel.hidden = true;
  const title = document.createElement('h3');
  title.textContent = 'Aanmelden bij CASPR++ chat';
  const note = document.createElement('p');
  note.textContent =
    'Gebruik je CASPR++ chatwachtwoord. Dit is een apart wachtwoord voor de chat.';
  const email = document.createElement('p');
  email.className = 'caspr-auth-email';
  email.textContent = getCurrentUser()?.email || 'Open CASPR vanuit je schoolaccount.';
  const tabs = document.createElement('nav');
  tabs.className = 'caspr-auth-tabs';
  tabs.setAttribute('aria-label', 'Chat aanmelden of herstellen');
  const modeButtons = new Map<string, HTMLButtonElement>();
  const form = document.createElement('form');
  const field = (text: string, type: string) => {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = type;
    label.append(input);
    form.append(label);
    return input;
  };
  const password = field('Chatwachtwoord', 'password');
  password.required = true;
  password.minLength = 12;
  password.maxLength = 128;
  password.autocomplete = 'current-password';
  const code = field('Activatiecode (alleen de eerste keer)', 'text');
  code.maxLength = 43;
  code.autocomplete = 'one-time-code';
  code.inputMode = 'numeric';
  const confirmation = field('Herhaal je nieuwe wachtwoord', 'password');
  confirmation.minLength = 12;
  confirmation.maxLength = 128;
  confirmation.autocomplete = 'new-password';
  const visibility = document.createElement('button');
  visibility.type = 'button';
  visibility.className = 'caspr-auth-visibility';
  const capsWarning = document.createElement('p');
  capsWarning.className = 'caspr-auth-caps';
  capsWarning.setAttribute('role', 'status');
  capsWarning.textContent = 'Caps Lock staat aan.';
  capsWarning.hidden = true;
  const hidePassword = () => {
    password.type = confirmation.type = 'password';
    visibility.textContent = 'Wachtwoord tonen';
    visibility.setAttribute('aria-pressed', 'false');
    capsWarning.hidden = true;
  };
  visibility.onclick = () => {
    const show = password.type === 'password';
    password.type = confirmation.type = show ? 'text' : 'password';
    visibility.textContent = show ? 'Wachtwoord verbergen' : 'Wachtwoord tonen';
    visibility.setAttribute('aria-pressed', String(show));
  };
  for (const input of [password, confirmation]) {
    const updateCaps = (event: KeyboardEvent) => {
      capsWarning.hidden = !event.getModifierState('CapsLock');
    };
    input.addEventListener('keydown', updateCaps);
    input.addEventListener('keyup', updateCaps);
    input.addEventListener('blur', () => {
      capsWarning.hidden = true;
    });
  }
  form.append(visibility, capsWarning);
  const requestCode = document.createElement('button');
  requestCode.type = 'button';
  requestCode.className = 'caspr-auth-request-code';
  requestCode.textContent = 'Code per e-mail aanvragen';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Aanmelden';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(requestCode, submit);
  const updateBusy = () => {
    submit.disabled = busy;
    requestCode.disabled = busy || cooldown;
    for (const button of modeButtons.values()) button.disabled = busy;
  };
  const setMode = (value: typeof mode) => {
    mode = value;
    hidePassword();
    password.value = code.value = confirmation.value = '';
    code.parentElement!.hidden =
      confirmation.parentElement!.hidden =
      requestCode.hidden =
        value === 'login';
    code.required = confirmation.required = value !== 'login';
    password.autocomplete = value === 'login' ? 'current-password' : 'new-password';
    title.textContent =
      value === 'login'
        ? 'Aanmelden bij CASPR++ chat'
        : value === 'activate'
          ? 'Activeer je chataccount'
          : 'Herstel je chatwachtwoord';
    note.textContent =
      value === 'login'
        ? 'Gebruik je CASPR++ chatwachtwoord. Dit is een apart wachtwoord voor de chat.'
        : 'Vraag een code aan op je schoolmail. Vul de code binnen 15 minuten in en kies een wachtwoord van minimaal 12 tekens.';
    code.parentElement!.firstChild!.textContent =
      value === 'reset' ? 'Resetcode uit je e-mail' : 'Activatiecode uit je e-mail';
    submit.textContent =
      value === 'login'
        ? 'Aanmelden'
        : value === 'activate'
          ? 'Account activeren'
          : 'Nieuw wachtwoord opslaan';
    for (const [key, button] of modeButtons)
      button.setAttribute('aria-pressed', String(key === value));
    status.textContent = '';
    updateBusy();
  };
  for (const [value, text] of [
    ['login', 'Inloggen'],
    ['activate', 'Account activeren'],
    ['reset', 'Wachtwoord vergeten'],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.onclick = () => setMode(value);
    modeButtons.set(value, button);
    tabs.append(button);
  }
  panel.append(title, note, email, tabs, form, status);
  setMode('login');
  const privacy = document.createElement('a');
  privacy.href = chrome.runtime.getURL('privacy.html');
  privacy.target = '_blank';
  privacy.rel = 'noopener noreferrer';
  privacy.textContent = 'Privacy en gegevens';
  panel.append(privacy);
  host.append(panel);
  const request = (action: string, payload = {}) =>
    chrome.runtime.sendMessage({
      type: 'chat:auth',
      action,
      email: getCurrentUser()?.email,
      ...payload,
    });
  requestCode.onclick = async () => {
    if (busy || cooldown) return;
    busy = true;
    updateBusy();
    status.textContent = 'Code aanvragen…';
    try {
      const result = await request('request-code', {
        purpose: mode,
        name: getCurrentUser()?.name,
        className: getCurrentClass(),
      });
      if (disposed) return;
      status.textContent = result?.ok
        ? result.message
        : result?.error || 'Code aanvragen mislukt.';
      if (result?.ok) {
        cooldown = true;
        requestCode.textContent = 'Nieuwe code aanvragen over 60 seconden';
        cooldownTimer = setTimeout(() => {
          cooldown = false;
          requestCode.textContent = 'Code per e-mail aanvragen';
          updateBusy();
        }, 60000);
        code.focus();
      }
    } catch {
      if (!disposed)
        status.textContent = 'Code aanvragen mislukt. Controleer je verbinding.';
    } finally {
      busy = false;
      if (!disposed) updateBusy();
    }
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (mode !== 'login' && password.value !== confirmation.value) {
      status.textContent = 'De twee wachtwoorden komen niet overeen.';
      confirmation.focus();
      return;
    }
    busy = true;
    updateBusy();
    status.textContent = 'Aanmelden…';
    try {
      const result = await request(
        mode === 'reset' ? 'reset' : code.value.trim() ? 'activate' : 'login',
        {
          password: password.value,
          code: code.value.trim(),
        },
      );
      if (disposed) return;
      if (!result?.ok) {
        status.textContent = result?.error || 'Aanmelden mislukt.';
        return;
      }
      password.value = code.value = confirmation.value = '';
      setMode('login');
      panel.hidden = true;
      reconnect();
    } catch {
      status.textContent = 'Aanmelden mislukt. Herlaad de extensie en probeer opnieuw.';
    } finally {
      busy = false;
      if (!disposed) updateBusy();
    }
  };
  const controls = document.createElement('div');
  controls.className = 'caspr-chat-account-controls';
  const devices = document.createElement('button');
  devices.type = 'button';
  devices.textContent = '🔐 Apparaten';
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.textContent = 'Uitloggen';
  controls.append(devices, logout);
  sidebar.append(controls);
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community';
  dialog.setAttribute('aria-label', 'Aangemelde apparaten');
  const header = document.createElement('header');
  const heading = document.createElement('h2');
  heading.textContent = 'Aangemelde apparaten';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.className = 'caspr-community-close';
  close.setAttribute('aria-label', 'Apparaten sluiten');
  close.onclick = () => dialog.close();
  header.append(heading, close);
  const list = document.createElement('ul');
  list.className = 'caspr-device-list';
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  dialog.append(header, list, feedback);
  document.body.append(dialog);
  const refresh = async () => {
    list.replaceChildren();
    feedback.textContent = 'Apparaten laden…';
    try {
      const data = await request('sessions');
      if (!data?.ok) {
        feedback.textContent = data?.error || 'Meld eerst aan.';
        return;
      }
      feedback.textContent = '';
      for (const session of data.sessions as {
        id: number;
        device: string;
        createdAt: number;
      }[]) {
        const row = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = `${session.device}${session.id === data.currentSessionId ? ' · dit apparaat' : ''} · ${new Date(session.createdAt).toLocaleDateString('nl-BE')}`;
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = 'Uitloggen';
        revoke.onclick = async () => {
          revoke.disabled = true;
          try {
            const result = await request('revoke', { sessionId: session.id });
            if (!result.ok) {
              feedback.textContent = result.error;
              return;
            }
            if (session.id === data.currentSessionId) {
              dialog.close();
              disconnect();
              panel.hidden = false;
            } else await refresh();
          } catch {
            feedback.textContent = 'Uitloggen mislukt.';
          } finally {
            revoke.disabled = false;
          }
        };
        row.append(text, revoke);
        list.append(row);
      }
    } catch {
      feedback.textContent = 'Apparaten ophalen mislukt.';
    }
  };
  devices.onclick = () => {
    dialog.showModal();
    void refresh();
  };
  logout.onclick = async () => {
    logout.disabled = true;
    try {
      const result = await request('logout');
      if (!result.ok) status.textContent = result.error;
      else disconnect();
      panel.hidden = false;
    } catch {
      status.textContent = 'Uitloggen mislukt.';
      panel.hidden = false;
    } finally {
      logout.disabled = false;
    }
  };
  return {
    show: () => {
      panel.hidden = false;
      status.textContent = '';
      password.focus();
    },
    hide: () => {
      panel.hidden = true;
    },
    cleanup: () => {
      disposed = true;
      clearTimeout(cooldownTimer);
      dialog.remove();
      controls.remove();
      panel.remove();
    },
  };
}
