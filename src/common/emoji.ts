export function emoji(value: string, className = 'caspr-emoji'): HTMLSpanElement {
  const element = document.createElement('span');

  element.className = className;
  element.textContent = value;
  element.setAttribute('aria-hidden', 'true');

  return element;
}
