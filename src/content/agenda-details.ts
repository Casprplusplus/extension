export function watchAgendaDetails(): void {
  const watched = new WeakSet<HTMLIFrameElement>();
  const styles = new Set<HTMLStyleElement>();
  const root = document.documentElement;

  let queued = false;

  const update = () => {
    queued = false;

    if (!root.hasAttribute('data-caspr-dashboard')) {
      styles.forEach((style) => style.remove());
      styles.clear();
      return;
    }

    const palette = getComputedStyle(root);
    for (const frame of document.querySelectorAll<HTMLIFrameElement>(
      '.modal .card-body iframe',
    )) {
      if (!watched.has(frame)) {
        watched.add(frame);
        frame.addEventListener('load', queue);
      }

      try {
        const doc = frame.contentDocument;
        if (!doc?.head) continue;

        let style = doc.querySelector<HTMLStyleElement>('#caspr-description-theme');

        if (!style) {
          style = doc.createElement('style');
          style.id = 'caspr-description-theme';
          doc.head.append(style);
        }

        styles.add(style);

        const css = `html,body { background: ${palette.getPropertyValue('--d-surface')} !important; color: ${palette.getPropertyValue('--d-text')} !important; } body :is(div,p,span,li,td,h1,h2,h3,h4,h5,h6) { background-color: transparent !important; color: inherit !important; } a { color: ${palette.getPropertyValue('--d-accent')} !important; }`;
        if (style.textContent !== css) style.textContent = css;
      } catch {}
    }
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(update);
  };

  new MutationObserver(queue).observe(document.body, {
    childList: true,
    subtree: true,
  });

  new MutationObserver(queue).observe(root, {
    attributes: true,
    attributeFilter: ['data-caspr-dashboard'],
  });

  queue();
}
