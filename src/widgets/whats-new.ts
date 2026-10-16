export const RELEASE_VERSION = chrome.runtime.getManifest().version;
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
          'Een persoonlijker startscherm en een opgefriste chat. Dit is nieuw in deze update:';
        const list = document.createElement('ul');
        for (const text of [
          'Theme Studio: eigen kleuren en achtergronden op alle CASPR-pagina’s, lokaal opgeslagen.',
          'Startscherm Studio: widgets verslepen met sleepgrepen, formaat aanpassen en layouts bewaren.',
          'Nieuwe widgets voor De Lijn en NMBS, met vertragingen en openklikbare ritten met de volgende haltes.',
          'Een weerwidget met plaatskeuze, temperatuur, neerslag, wind en een verwachting voor drie dagen.',
          'Opgefriste chat met gegroepeerde berichten, datumscheidingen en een verstelbare zijbalk.',
          'Een apart reactievenster met emoji-tabs en een overzicht van wie reageerde.',
          'Duidelijkere vriendschapsverzoeken en groepsuitnodigingen, plus een aparte beheersectie.',
          'Focusmodus verbergt Chats en Games, ook in de navigatie.',
          'Een compactere extensiepopup met een hoofdschakelaar die CASPR++ volledig uitzet.',
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
