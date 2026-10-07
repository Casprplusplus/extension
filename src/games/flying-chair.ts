export function mountFlyingChair(container: HTMLElement): () => void {
  const card = document.createElement('div');
  card.className = 'col-md-3 caspr-game-column';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'leerlingAppTile caspr-chair-tile';
  open.setAttribute('aria-haspopup', 'dialog');

  const icon = document.createElement('span');
  icon.className = 'caspr-tile-emoji';
  icon.textContent = '🪑';
  icon.setAttribute('aria-hidden', 'true');

  open.append(icon, document.createTextNode('De Vliegende Stoel'));
  card.append(open);

  container.append(card);

  const dialog = document.createElement('dialog');
  dialog.className = 'caspr-chair-game';
  dialog.setAttribute('aria-label', 'De Vliegende Stoel');

  const header = document.createElement('header');
  const heading = document.createElement('h2');

  heading.textContent = '🪑 De Vliegende Stoel';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Sluiten ✕';

  const headingGroup = document.createElement('div');
  const eyebrow = document.createElement('span');

  eyebrow.className = 'caspr-chair-eyebrow';
  eyebrow.textContent = 'KLASARCADE · 🪑 AIRLINES';

  headingGroup.append(eyebrow, heading);
  header.append(headingGroup, close);

  const instructions = document.createElement('p');
  instructions.textContent =
    'Raak de cartoonleerlingen! Klik of tik op een figuurtje, of gebruik 1, 2 en 3. Een rondje duurt 30 seconden.';

  const stats = document.createElement('div');
  stats.className = 'caspr-chair-stats';

  const values = ['Punten', 'Seconden', 'Record'].map((label) => {
    const box = document.createElement('div');
    const caption = document.createElement('span');

    caption.textContent = label;

    const value = document.createElement('strong');
    box.append(caption, value);
    stats.append(box);

    return value;
  });

  const progress = document.createElement('progress');
  progress.className = 'caspr-chair-progress';
  progress.max = 30000;
  progress.value = 30000;
  progress.setAttribute('aria-label', 'Resterende speeltijd');

  const arena = document.createElement('div');
  arena.className = 'caspr-chair-arena';
  arena.setAttribute('aria-label', 'Cartoonklas');

  const blackboard = document.createElement('div');
  blackboard.className = 'caspr-chair-blackboard';
  blackboard.textContent = 'Vandaag: toegepaste stoelvaart';

  arena.append(blackboard);

  const feedback = document.createElement('p');
  feedback.className = 'caspr-chair-feedback';
  feedback.setAttribute('aria-live', 'polite');
  feedback.textContent = 'De vloer is lava. De stoel is luchtmacht.';

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'caspr-chair-start';
  start.textContent = 'Start!';

  const footer = document.createElement('footer');
  footer.append(feedback, start);
  dialog.append(header, instructions, stats, progress, arena, footer);
  document.body.append(dialog);

  let score = 0;
  let best = 0;
  let running = false;
  let remaining = 30000;
  let lastTick = 0;
  let lastHit = 0;
  let lastMove = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const targets: HTMLButtonElement[] = [];
  const jokes = [
    'Stoel geslaagd. Zwaartekracht gebuisd.',
    'Dat was geen zitplaats, dat was een leerling.',
    'Nieuwe les: luchtmeubilair.',
    'De stoel heeft meer beweging dan de klas.',
    'Economy class? Nee, classroom.',
  ];

  const updateStats = () => {
    [score, Math.ceil(remaining / 1000), best].forEach((value, index) => {
      const text = String(value);
      if (values[index].textContent !== text) values[index].textContent = text;
    });

    progress.value = remaining;
  };

  const moveTargets = () => {
    targets.forEach((target, index) => {
      target.style.left = `${5 + index * 30 + Math.random() * 8}%`;
      target.style.top = `${37 + Math.random() * 32}%`;
    });
  };

  const finish = () => {
    running = false;
    clearInterval(timer);
    timer = undefined;

    targets.forEach((target) => {
      target.disabled = true;
    });

    best = Math.max(best, score);

    void chrome.storage.local.set({ chairGameBest: best }).catch(() => {});
    updateStats();

    feedback.textContent = `${score} punten! ${score >= 200 ? 'Je stoel mag naar de luchtvaartschool. ✈️' : 'De stoel vraagt nu zelf een pauze. 🪑'}`;
    start.disabled = false;
    start.textContent = 'Nog een rondje';
    start.focus();
  };

  const hit = (index: number) => {
    if (!running || document.hidden || performance.now() - lastHit < 450) return;
    lastHit = performance.now();
    score += 10;

    feedback.textContent = jokes[Math.floor(Math.random() * jokes.length)];
    const target = targets[index];

    const chair = document.createElement('span');
    chair.className = 'caspr-flying-chair';
    chair.textContent = '🪑';
    chair.setAttribute('aria-hidden', 'true');
    arena.append(chair);

    const arenaRect = arena.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const destinationX = targetRect.left - arenaRect.left + targetRect.width / 2;
    const destinationY = targetRect.top - arenaRect.top;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animation = chair.animate(
      [
        {
          transform: `translate(${arenaRect.width / 2}px, ${arenaRect.height - 45}px) rotate(-30deg) scale(.6)`,
          opacity: 1,
        },
        {
          transform: `translate(${destinationX}px, ${destinationY}px) rotate(330deg) scale(1.2)`,
          opacity: 1,
        },
        {
          transform: `translate(${destinationX}px, ${destinationY}px) rotate(350deg) scale(1.4)`,
          opacity: 0,
        },
      ],
      { duration: reduced ? 1 : 420, easing: 'ease-out' },
    );

    animation.onfinish = () => chair.remove();
    updateStats();
  };
  ['🧑‍🎓', '👩‍🎓', '👨‍🎓'].forEach((face, index) => {
    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'caspr-chair-target';

    const faceIcon = document.createElement('span');
    faceIcon.className = 'caspr-chair-face';
    faceIcon.textContent = face;

    const key = document.createElement('kbd');
    key.textContent = String(index + 1);
    target.append(faceIcon, key);
    target.setAttribute('aria-label', `Mik op cartoonleerling ${index + 1}`);
    target.disabled = true;
    target.addEventListener('click', () => hit(index));
    targets.push(target);
    arena.append(target);
  });

  moveTargets();
  updateStats();

  void chrome.storage.local
    .get('chairGameBest')
    .then((data) => {
      if (
        typeof data.chairGameBest === 'number' &&
        Number.isFinite(data.chairGameBest) &&
        data.chairGameBest >= 0
      )
        best = Math.max(best, data.chairGameBest);
      updateStats();
    })
    .catch(() => {});

  start.addEventListener('click', () => {
    score = 0;
    remaining = 30000;
    running = true;
    lastTick = performance.now();
    lastHit = -Infinity;
    lastMove = lastTick;

    start.disabled = true;
    start.textContent = 'Stoelen onderweg…';
    feedback.textContent = 'Cabinepersoneel, klaar voor vertrek!';
    targets.forEach((target) => {
      target.disabled = false;
    });

    targets[0].focus();

    updateStats();

    timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) remaining = Math.max(0, remaining - (now - lastTick));
      lastTick = now;

      if (document.hidden) return;
      if (remaining === 0) return finish();
      if (now - lastMove > 1300) {
        moveTargets();
        lastMove = now;
      }

      updateStats();
    }, 100);
  });

  const visibility = () => {
    lastTick = performance.now();
  };

  document.addEventListener('visibilitychange', visibility);
  dialog.addEventListener('keydown', (event) => {
    if (/^[123]$/.test(event.key)) {
      event.preventDefault();
      hit(Number(event.key) - 1);
    }
  });

  open.addEventListener('click', () => {
    dialog.showModal();
    start.focus();
  });

  close.addEventListener('click', () => dialog.close());

  dialog.addEventListener('close', () => {
    running = false;

    clearInterval(timer);

    timer = undefined;

    targets.forEach((target) => {
      target.disabled = true;
    });

    start.disabled = false;
    start.textContent = 'Start!';

    arena.querySelectorAll('.caspr-flying-chair').forEach((chair) => chair.remove());

    open.focus();
  });

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibility);

    dialog.remove();
    card.remove();
  };
}
