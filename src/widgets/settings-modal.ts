let reopen = false;

export function mountSettingsModal(content: HTMLElement, grid?: HTMLElement): () => void {
  const panels = [...content.querySelectorAll<HTMLElement>('.caspr-dashboard-controls')];
  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-community caspr-settings-modal';
  dialog.setAttribute('aria-label', 'Dashboardinstellingen');

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = '⚙️ Instellingen';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'caspr-community-close';
  close.textContent = '✕';

  close.setAttribute('aria-label', 'Instellingen sluiten');
  close.addEventListener('click', () => dialog.close());

  header.append(title, close);

  const intro = document.createElement('p');
  intro.className = 'caspr-community-intro';
  intro.textContent =
    'Kies welke tegels en navigatie je ziet, pas de volgorde aan of schakel focusmodus in. Wijzigingen worden direct opgeslagen.';

  dialog.append(header, intro, ...panels);
  document.body.append(dialog);

  const column = document.createElement('div');
  column.className = grid ? 'col-md-3' : 'caspr-settings-shortcut';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = grid ? 'leerlingAppTile caspr-chair-tile' : 'caspr-focus-toggle';
  button.setAttribute('aria-haspopup', 'dialog');

  const icon = document.createElement('span');
  icon.className = 'caspr-tile-emoji';
  icon.textContent = '⚙️';

  button.append(icon, document.createTextNode('Instellingen'));

  button.addEventListener('click', () => {
    reopen = true;
    dialog.showModal();
  });

  column.append(button);
  (grid || content).append(column);

  dialog.addEventListener('close', () => {
    reopen = false;
  });

  if (reopen) dialog.showModal();

  return () => {
    reopen = dialog.open;

    for (const panel of panels) content.append(panel);

    dialog.remove();
    column.remove();
  };
}
