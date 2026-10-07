export function renderSplashText(target: HTMLElement, text: string): void {
  const normalized = text.replace(/\\r\\n|\\n|\\r/g, '\n');
  const nodes: Node[] = [];

  let italics = 0;
  let strong = 0;
  let markdownBold = false;

  for (const part of normalized.split(
    /(<\/?i>|<\/?strong>|\*\*|<br\s*\/?>|\r\n|\r|\n)/gi,
  )) {
    if (part === '**') {
      markdownBold = !markdownBold;
      continue;
    }

    if (/^<strong>$/i.test(part)) {
      strong++;
      continue;
    }

    if (/^<\/strong>$/i.test(part)) {
      strong = Math.max(0, strong - 1);
      continue;
    }

    if (/^<i>$/i.test(part)) {
      italics++;
      continue;
    }

    if (/^<\/i>$/i.test(part)) {
      italics = Math.max(0, italics - 1);
      continue;
    }

    if (/^(<br\s*\/?>|\r\n|\r|\n)$/i.test(part)) {
      nodes.push(document.createElement('br'));
    } else if (part) {
      let node: Node = document.createTextNode(part);

      if (strong || markdownBold) {
        const bold = document.createElement('strong');
        bold.append(node);
        node = bold;
      }

      if (italics) {
        const italic = document.createElement('i');
        italic.append(node);
        nodes.push(italic);
      } else nodes.push(node);
    }
  }

  target.replaceChildren(...nodes);
}
