export const RELEASE_VERSION = '1.2.0';
export function mountWhatsNew(): () => void {
  let disposed = false;
  let dialog: HTMLDialogElement | undefined;
  const key = 'whatsNewSeenVersion';
  void chrome.storage.local
    .get(key)
    .then(async (stored) => {
      if (disposed || stored[key] === RELEASE_VERSION) return;
      await navigator.locks.request('caspr-whats-new', async () => {
        if (disposed || (await chrome.storage.local.get(key))[key] === RELEASE_VERSION)
          return;
        // Mark while holding the lock so another CASPR tab does not show the same release.
        await chrome.storage.local.set({ [key]: RELEASE_VERSION });
        if (disposed) return;
        dialog = document.createElement('dialog');
        dialog.className = 'caspr-community caspr-social-dialog caspr-whats-new';
        dialog.setAttribute('aria-label', 'Wat is nieuw in CASPR++');
        const title = document.createElement('h2');
        title.textContent = `Nieuw in CASPR++ · ${RELEASE_VERSION}`;
        const intro = document.createElement('p');
        intro.textContent =
          'Je nieuwe schooldag, met meer mogelijkheden voor samen werken.';
        const list = document.createElement('ul');
        for (const text of [
          'Privégroepen, polls en vastgezette berichten.',
          'Groepswerk met taken, deadlines en samen focussen.',
          'Berichten zoeken en @vermeldingen.',
          'Levels, VIP en een zelfgekozen beloningsbadge.',
          'Chatprofielen, favoriete chats en concepten per gesprek.',
          'Zelf je account activeren en je wachtwoord herstellen via schoolmail.',
          'Berichten rapporteren en uitnodigingen blokkeren.',
        ]) {
          const item = document.createElement('li');
          item.textContent = text;
          list.append(item);
        }
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Aan de slag';
        close.onclick = () => dialog?.close();
        dialog.append(title, intro, list, close);
        dialog.addEventListener('close', () => dialog?.remove());
        document.body.append(dialog);
        dialog.showModal();
      });
    })
    .catch(() => {});
  return () => {
    disposed = true;
    dialog?.close();
    dialog?.remove();
  };
}
