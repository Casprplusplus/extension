export function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}
