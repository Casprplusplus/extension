import {
  countdownTarget,
  nextSchoolLesson,
  type Lesson,
  type TimeOptions,
} from '../common/time-widgets';
import { accountScope } from '../common/account-scope';
import { setText } from '../common/dom';
import { refreshSchedule } from '../content/schedule-request';
import { isCurrentUser } from '../common/user';
import { schoolDayLessons, schoolDate } from '../common/school-day';

export function addTimeWidgets(
  container: HTMLElement,
  options: TimeOptions,
  cached: unknown,
): () => void {
  const cache = cached as
    | { captured?: number; lessons?: Lesson[]; scope?: string; source?: string }
    | undefined;
  const scope = accountScope();
  const fresh =
    Boolean(scope) &&
    cache?.scope === scope &&
    typeof cache?.captured === 'number' &&
    Date.now() - cache.captured < 7 * 86400000;
  const lessons =
    fresh && Array.isArray(cache?.lessons)
      ? cache.lessons.filter(
          (e) =>
            e &&
            typeof e === 'object' &&
            Number.isFinite(e.start) &&
            Number.isFinite(e.end) &&
            e.end > e.start &&
            typeof e.subject === 'string' &&
            typeof e.room === 'string',
        )
      : [];

  const countdown = document.createElement('article');
  countdown.className = 'caspr-countdown-widget';

  const heading = document.createElement('h3');
  heading.textContent =
    options.label || (options.target ? 'Aftellen naar vrijheid' : 'Einde laatste les');

  const number = document.createElement('strong');
  number.className = 'caspr-seconds';

  const joke = document.createElement('p');
  const goal = document.createElement('p');

  countdown.append(heading, number, joke, goal);

  if (options.countdown) container.append(countdown);

  const lesson = document.createElement('article');
  lesson.className = 'caspr-next-lesson-widget';

  const lessonTitle = document.createElement('h3');
  lessonTitle.textContent = 'Volgende les';

  const subject = document.createElement('strong');
  const detail = document.createElement('p');
  const room = document.createElement('p');
  room.className = 'caspr-next-room';

  const note = document.createElement('p');

  //Give Warre a warning xD
  if (isCurrentUser('ll-10168@broeders.be') && subject.textContent == 'NED') {
    note.textContent = 'WARRE, PAS OP VOOR VLIEGENDE STOELEN!!!';
  }

  const link = document.createElement('a');
  link.href = '/leerlingapp/Uurrooster';
  link.textContent = 'Uurrooster openen';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'caspr-refresh-schedule';
  refresh.textContent = 'Rooster vernieuwen';

  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    refresh.textContent = 'Rooster ophalen…';

    const success = await refreshSchedule(true);
    refresh.disabled = false;
    refresh.textContent = success ? 'Rooster bijgewerkt' : 'Opnieuw proberen';

    if (!success)
      note.textContent =
        'Ophalen lukt niet. Controleer je verbinding of meld opnieuw aan bij CASPR.';
  });

  const lessonActions = document.createElement('div');
  lessonActions.className = 'caspr-grades-actions';
  lessonActions.append(refresh, link);
  lesson.append(lessonTitle, subject, room, detail, note, lessonActions);
  if (options.nextLesson) container.append(lesson);
  const today = document.createElement('article');
  today.className = 'caspr-today-widget';
  const todayTitle = document.createElement('h3');
  const todayNote = document.createElement('p');
  const todayList = document.createElement('ol');
  todayList.className = 'caspr-today-lessons';
  const todayRefresh = document.createElement('button');
  todayRefresh.type = 'button';
  todayRefresh.className = 'caspr-refresh-schedule';
  todayRefresh.textContent = 'Rooster vernieuwen';
  todayRefresh.onclick = () => refresh.click();
  today.append(todayTitle, todayNote, todayList, todayRefresh);
  container.append(today);
  let daySignature = '';

  return () => {
    const current = Date.now();
    const stillFresh =
      typeof cache?.captured === 'number' && current - cache.captured < 7 * 86400000;
    const dayLessons = schoolDayLessons(stillFresh ? lessons : [], current);
    const signature = `${dayLessons.target === undefined ? '' : schoolDate(dayLessons.target)}|${dayLessons.lessons.map((l) => `${l.start}:${l.end <= current ? 'done' : l.start <= current ? 'current' : 'future'}`).join(',')}`;
    if (signature !== daySignature) {
      daySignature = signature;
      todayTitle.textContent = dayLessons.weekend
        ? dayLessons.target
          ? `Volgende lesdag · ${new Date(dayLessons.target).toLocaleDateString('nl-BE', { weekday: 'long', timeZone: 'Europe/Brussels' })}`
          : 'Na het weekend'
        : 'Vandaag';
      todayNote.textContent = dayLessons.lessons.length
        ? `${dayLessons.lessons.length} lessen · ${dayLessons.weekend ? 'Geniet eerst van je weekend.' : dayLessons.lessons.every((l) => l.end <= current) ? 'Je schooldag zit erop' : `${dayLessons.lessons.filter((l) => l.end > current).length} nog te gaan`}`
        : fresh && stillFresh
          ? 'Geen lessen gevonden voor deze dag. Vernieuw je rooster als dit niet klopt.'
          : 'Haal je rooster op om je lessen en lokalen te zien.';
      todayList.replaceChildren();
      for (const item of dayLessons.lessons) {
        const row = document.createElement('li');
        row.dataset.state =
          item.end <= current ? 'done' : item.start <= current ? 'current' : 'future';
        const time = document.createElement('time');
        time.dateTime = new Date(item.start).toISOString();
        const clock = (stamp: number) =>
          new Date(stamp).toLocaleTimeString('nl-BE', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Brussels',
          });
        time.textContent = `${clock(item.start)}–${clock(item.end)}`;
        const name = document.createElement('strong');
        name.textContent = item.subject;
        const room = document.createElement('span');
        room.textContent = `📍 ${item.room || 'Lokaal onbekend'}`;
        const state = document.createElement('small');
        state.textContent =
          row.dataset.state === 'current'
            ? 'Nu'
            : row.dataset.state === 'done'
              ? 'Afgelopen'
              : 'Straks';
        row.append(time, name, room, state);
        todayList.append(row);
      }
    }
    const target = countdownTarget(options, new Date(current), stillFresh ? lessons : []);
    const seconds = target
      ? Math.max(0, Math.ceil((target.getTime() - current) / 1000))
      : undefined;
    if (options.countdown) {
      const weekend =
        !options.target &&
        ['Sat', 'Sun'].includes(
          new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            timeZone: 'Europe/Brussels',
          }).format(current),
        );
      setText(
        number,
        weekend
          ? 'Het is weekend 🎉'
          : seconds === undefined
            ? 'Rooster nodig'
            : seconds === 0
              ? 'Schooldag voorbij'
              : `${seconds.toLocaleString('nl-BE')} seconden`,
      );
      setText(
        goal,
        weekend
          ? 'Maandag zien we wel weer verder.'
          : target
            ? target.toLocaleString('nl-BE', {
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Brussels',
              })
            : 'Je rooster wordt automatisch opgehaald.',
      );
      setText(
        joke,
        weekend
          ? 'De schoolbel heeft ook even vrij. Geniet ervan!'
          : seconds === undefined
            ? 'Zonder rooster weet zelfs de stoel niet wanneer hij naar huis mag.'
            : seconds === 0
              ? 'Achievement unlocked: wachten uitgespeeld! 🎉'
              : seconds > 86400
                ? 'Nog even. Of een héél lange even.'
                : seconds > 3600
                  ? 'De klok doet haar best. Hopelijk jij ook!'
                  : 'Niet naar de klok staren. Oeps, te laat.',
      );
    }

    if (!options.nextLesson) return;
    const upcoming = stillFresh ? nextSchoolLesson(lessons, current) : undefined;

    setText(subject, upcoming?.subject || 'Geen volgende les');
    setText(room, upcoming ? `📍 Lokaal ${upcoming.room || 'onbekend'}` : '');

    const nextDate = upcoming ? new Date(upcoming.start) : undefined;
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Europe/Brussels',
    }).format(current);

    const nextDay = nextDate
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          timeZone: 'Europe/Brussels',
        }).format(nextDate)
      : '';

    setText(
      lessonTitle,
      ['Fri', 'Sat', 'Sun'].includes(day) && nextDay === 'Mon'
        ? 'Maandag: eerste les'
        : 'Volgende les',
    );

    const minutes = upcoming
      ? Math.max(0, Math.ceil((upcoming.start - current) / 60000))
      : 0;
    const dateKey = (stamp: number) =>
      new Date(stamp).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' });
    const tomorrow = new Date(current);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const when = upcoming
      ? dateKey(upcoming.start) === dateKey(current)
        ? 'Vandaag'
        : dateKey(upcoming.start) === dateKey(tomorrow.getTime())
          ? 'Morgen'
          : new Date(upcoming.start).toLocaleDateString('nl-BE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'Europe/Brussels',
            })
      : '';
    const timeLabel = upcoming
      ? new Date(upcoming.start).toLocaleTimeString('nl-BE', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Brussels',
        })
      : '';
    const wait =
      minutes < 60
        ? `Over ${minutes} min`
        : `Over ${Math.floor(minutes / 60)} uur${minutes % 60 ? ` en ${minutes % 60} min` : ''}`;
    setText(
      detail,
      upcoming
        ? `${when} om ${timeLabel}${dateKey(upcoming.start) === dateKey(current) ? ` · ${wait}` : ''}`
        : fresh && cache?.source === 'request'
          ? 'Geen komende les gevonden in het opgehaalde rooster. Je kunt opnieuw vernieuwen.'
          : 'Het rooster wordt automatisch opgehaald. Je kunt het ook zelf vernieuwen.',
    );
  };
}
