import {
  parsePomodoro,
  pomodoroSeconds,
  nextPomodoro,
  pomodoroShouldRing,
} from '../common/pomodoro';
import { getCurrentUser } from '../common/user';

export function mountPomodoro(container: HTMLElement): () => void {
  const key = `pomodoro:${getCurrentUser()?.email || 'local'}`;
  let state = parsePomodoro(undefined);
  let disposed = false;
  let notifying = false;
  let audio: AudioContext | undefined;
  const article = document.createElement('article');
  article.className = 'caspr-pomodoro';
  const title = document.createElement('h3');
  title.textContent = '🎯 Pomodoro';
  const time = document.createElement('div');
  time.className = 'caspr-pomodoro-time';
  const dial = document.createElement('div');
  dial.className = 'caspr-pomodoro-dial';
  const phaseLabel = document.createElement('small');
  dial.append(time, phaseLabel);
  const status = document.createElement('p');
  const controls = document.createElement('div');
  controls.className = 'caspr-pomodoro-controls';
  const start = document.createElement('button');
  start.type = 'button';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset ronde';
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Volgende ronde';
  controls.append(start, reset, next);
  const options = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Timer instellen';
  options.append(summary);
  const soundLabel = document.createElement('label');
  const sound = document.createElement('input');
  sound.type = 'checkbox';
  soundLabel.append(sound, document.createTextNode('Geluid wanneer de ronde klaar is'));
  const testSound = document.createElement('button');
  testSound.type = 'button';
  testSound.textContent = 'Geluid testen';
  const audioStatus = document.createElement('p');
  audioStatus.setAttribute('role', 'status');
  options.append(soundLabel, testSound, audioStatus);
  const soundNote = document.createElement('p');
  soundNote.textContent =
    'Geluid werkt zolang het dashboard open staat. Een slapend tabblad kan de melding vertragen.';
  options.append(soundNote);
  const unlockAudio = async () => {
    audio ||= new AudioContext();
    await audio.resume();
    return audio;
  };
  const playSound = async () => {
    try {
      const context = await unlockAudio();
      if (disposed || context.state !== 'running') return;
      for (let i = 0; i < 3; i++) {
        const tone = context.createOscillator();
        const gain = context.createGain();
        const begin = context.currentTime + i * 0.24;
        tone.frequency.value = i === 2 ? 880 : 660;
        gain.gain.setValueAtTime(0.07, begin);
        gain.gain.exponentialRampToValueAtTime(0.001, begin + 0.18);
        tone.connect(gain);
        gain.connect(context.destination);
        tone.start(begin);
        tone.stop(begin + 0.2);
      }
      audioStatus.textContent = '';
    } catch {
      if (!disposed)
        audioStatus.textContent =
          'Je browser blokkeert geluid. Klik op Geluid testen om het toe te staan.';
    }
  };
  testSound.onclick = () => void playSound();
  sound.onchange = () => {
    state.sound = sound.checked;
    if (state.sound)
      void unlockAudio().catch(() => {
        if (!disposed)
          audioStatus.textContent = 'Klik op Geluid testen om geluid toe te staan.';
      });
    void save();
  };
  const inputs: HTMLInputElement[] = [];
  const phases = ['focus', 'break', 'long'] as const;
  for (const [index, labelText] of ['Focus', 'Korte pauze', 'Lange pauze'].entries()) {
    const label = document.createElement('label');
    label.textContent = `${labelText} (minuten)`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '120';
    input.step = '1';
    input.onchange = () => {
      if (!input.checkValidity()) return;
      state.durations[phases[index]] = Number(input.value);
      if (state.endsAt === null) state.remaining = state.durations[state.phase] * 60;
      void save();
    };
    inputs.push(input);
    label.append(input);
    options.append(label);
  }
  article.append(title, dial, status, controls, options);
  container.append(article);
  const render = () => {
    if (disposed) return;
    const remaining = pomodoroSeconds(state, Date.now());
    const fraction = Math.max(
      0,
      Math.min(1, remaining / (state.durations[state.phase] * 60)),
    );
    dial.style.setProperty('--timer-progress', `${fraction * 360}deg`);
    phaseLabel.textContent = state.phase === 'focus' ? 'Focus' : 'Pauze';
    time.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    status.textContent =
      remaining === 0
        ? 'Ronde klaar! Start de volgende ronde wanneer je klaar bent.'
        : `${state.phase === 'focus' ? 'Focustijd' : state.phase === 'long' ? 'Lange pauze' : 'Korte pauze'} · ${state.rounds} focusrondes afgerond`;
    start.textContent = state.endsAt !== null && remaining > 0 ? 'Pauzeren' : 'Start';
    start.disabled = remaining === 0;
    next.hidden = remaining !== 0;
    sound.checked = state.sound;
    testSound.disabled = !state.sound;
    if (pomodoroShouldRing(state, Date.now()) && !notifying) {
      notifying = true;
      // A browser lock and stored completion prevent two CASPR tabs ringing twice.
      void navigator.locks
        .request(`caspr-pomodoro:${key}`, async () => {
          const stored = await chrome.storage.local.get(key);
          if (disposed) return;
          const current = parsePomodoro(stored[key]);
          if (current.endsAt !== state.endsAt || !pomodoroShouldRing(current, Date.now()))
            return;
          current.notifiedEnd = current.endsAt;
          await chrome.storage.local.set({ [key]: current });
          if (disposed) return;
          state = current;
          await playSound();
        })
        .catch(() => {
          if (!disposed)
            audioStatus.textContent = 'Timergeluid kon niet worden afgespeeld.';
        })
        .finally(() => {
          notifying = false;
        });
    }
    inputs.forEach((input, i) => {
      if (document.activeElement !== input)
        input.value = String(state.durations[phases[i]]);
    });
  };
  const save = async () => {
    render();
    try {
      await chrome.storage.local.set({ [key]: state });
    } catch {
      if (!disposed) status.textContent = 'Timer kon niet worden opgeslagen.';
    }
  };
  start.onclick = () => {
    if (state.sound) void unlockAudio().catch(() => {});
    const remaining = pomodoroSeconds(state, Date.now());
    state = {
      ...state,
      remaining,
      endsAt: state.endsAt === null ? Date.now() + remaining * 1000 : null,
    };
    void save();
  };
  reset.onclick = () => {
    state = {
      ...state,
      endsAt: null,
      remaining: state.durations[state.phase] * 60,
    };
    void save();
  };
  next.onclick = () => {
    state = nextPomodoro(state);
    void save();
  };
  const changed = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[key]) {
      state = parsePomodoro(changes[key].newValue);
      render();
    }
  };
  chrome.storage.onChanged.addListener(changed);
  start.disabled = true;
  void chrome.storage.local
    .get(key)
    .then((data) => {
      if (!disposed) {
        state = parsePomodoro(data[key]);
        render();
      }
    })
    .catch(() => {
      if (!disposed) status.textContent = 'Timer ophalen mislukt.';
    });
  const timer = setInterval(render, 1000);
  return () => {
    disposed = true;
    clearInterval(timer);
    chrome.storage.onChanged.removeListener(changed);
    article.remove();
    void audio?.close();
  };
}
