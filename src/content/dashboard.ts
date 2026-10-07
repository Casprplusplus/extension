import { mountWhatsNew } from '../widgets/whats-new';
import { parseDashboard } from '../common/dashboard';
import { parseSettings, splashes } from '../common/themes';
import { parseTimeOptions } from '../common/time-widgets';
import { mountDashboardWidgets } from '../widgets/dashboard';
import { studentPage } from '../common/student-pages';
import { decorateTiles, decorateNavigation } from '../widgets/tile-icons';
import { refreshSchedule, cancelScheduleRequests } from './schedule-request';
import { mountCommunity } from '../widgets/community';
import { watchAgendaDetails } from './agenda-details';
import { mountGrades } from '../widgets/grades';
import { cancelGradesRequest } from './grades-request';
import { parseDashboardLayout } from '../common/dashboard-layout';
import { mountDashboardLayout } from '../widgets/dashboard-layout';
import { mountNavigationLayout } from '../widgets/navigation-layout';
import {
  getCurrentUser,
  getCurrentClass,
  isStudentEmail,
  watchStudentAccount,
} from '../common/user';
import { mountSettingsModal } from '../widgets/settings-modal';
import { watchChatInbox } from './chat-inbox';

const page = studentPage(location.pathname);
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type === 'caspr:student-access') {
    reply({ allowed: isStudentEmail(getCurrentUser()?.email) });
  }
});
let cleanupInbox: (() => void) | undefined;
let cleanupWhatsNew: (() => void) | undefined;
let activeAccount = '';
function syncAccount() {
  const user = getCurrentUser();
  const email = isStudentEmail(user?.email) ? user!.email : '';
  if (email === activeAccount) return;
  activeAccount = email;
  cleanupInbox?.();
  cleanupInbox = undefined;
  cleanupWhatsNew?.();
  cleanupWhatsNew = undefined;
  cancelGradesRequest();
  cancelScheduleRequests();
  if (!email || !page) return;
  cleanupInbox = watchChatInbox();
  if (page === 'dashboard') cleanupWhatsNew = mountWhatsNew();
  const className = getCurrentClass();
  if (page === 'dashboard' && user && className)
    void chrome.runtime
      .sendMessage({ type: 'users:register', ...user, className })
      .catch(() => {});
}

if (page === 'agenda') watchAgendaDetails();

let timeOptions = parseTimeOptions(undefined);
let lessonCache: unknown;

const root = document.documentElement;
const content = document.querySelector<HTMLElement>('.main-content .container-fluid');
const tiles = Array.from(
  document.querySelectorAll<HTMLAnchorElement>('.main-content .leerlingAppTile'),
);

let cleanupWidgets: (() => void) | undefined;
let cleanupGame: (() => void) | undefined;
let cleanupGrades: (() => void) | undefined;
let cleanupLayout: (() => void) | undefined;
let layout = parseDashboardLayout(undefined);
let navigationLayout = parseDashboardLayout(undefined);
let cleanupNavigation: (() => void) | undefined;
let cleanupSettings: (() => void) | undefined;

let revision = 0;
let dashboard = parseDashboard(undefined);
let theme = parseSettings(undefined);

const joke = splashes[Math.floor(Math.random() * splashes.length)];

function apply(): void {
  syncAccount();
  if (!content || !page) return;

  cleanupSettings?.();
  cleanupSettings = undefined;
  cleanupNavigation?.();
  cleanupNavigation = undefined;
  cleanupLayout?.();
  cleanupLayout = undefined;
  cleanupWidgets?.();
  cleanupWidgets = undefined;
  cleanupGame?.();
  cleanupGame = undefined;
  cleanupGrades?.();
  cleanupGrades = undefined;

  if (!dashboard.enabled || !isStudentEmail(getCurrentUser()?.email)) {
    cancelGradesRequest();
    cancelScheduleRequests();

    root.removeAttribute('data-caspr-dashboard');
    root.removeAttribute('data-caspr-page');

    document
      .querySelectorAll('[data-caspr-current]')
      .forEach((e) => e.removeAttribute('data-caspr-current'));

    root.removeAttribute('data-caspr-glass');
    root.style.removeProperty('--d-card-alpha');
    root.style.removeProperty('--dash-photo');
    document
      .querySelectorAll('.caspr-nav-emoji, .caspr-tile-emoji')
      .forEach((node) => node.remove());
    document
      .querySelectorAll('[data-caspr-nav-icon]')
      .forEach((node) => node.removeAttribute('data-caspr-nav-icon'));

    return;
  }

  root.dataset.casprDashboard = theme.theme;
  if (page === 'puntenboek' || (page === 'dashboard' && dashboard.widgets))
    cleanupGrades = mountGrades(content);

  decorateTiles(tiles);
  decorateNavigation();

  cleanupNavigation = mountNavigationLayout(content, navigationLayout);

  root.dataset.casprPage = page;

  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '.navbar-sidebar a, .navbar-mobile a',
  )) {
    const target = studentPage(new URL(link.href, location.href).pathname);

    if (target === page) link.dataset.casprCurrent = 'true';
    else link.removeAttribute('data-caspr-current');
  }

  root.dataset.casprGlass = String(dashboard.glass);
  root.style.setProperty('--d-card-alpha', `${100 - dashboard.transparency}%`);
  root.style.setProperty(
    '--dash-photo',
    dashboard.photo ? `url("${dashboard.photo}")` : 'none',
  );

  if (page === 'dashboard' && tiles.length) {
    const customized = mountDashboardLayout(content, tiles, layout);
    cleanupLayout = customized.cleanup;

    if (!layout.focus) cleanupGame = mountCommunity(customized.grid);
    cleanupSettings = mountSettingsModal(content, customized.grid);
  } else cleanupSettings = mountSettingsModal(content);

  if (!dashboard.widgets || page !== 'dashboard' || !tiles.length) return;

  cleanupWidgets = mountDashboardWidgets(
    content,
    tiles,
    theme,
    timeOptions,
    lessonCache,
    joke,
    dashboard,
  );

  if (
    (timeOptions.nextLesson || (timeOptions.countdown && !timeOptions.target)) &&
    !document.hidden
  )
    void refreshSchedule();
}

const refreshVisibleSchedule = () => {
  if (
    page === 'dashboard' &&
    isStudentEmail(getCurrentUser()?.email) &&
    dashboard.enabled &&
    dashboard.widgets &&
    (timeOptions.nextLesson || (timeOptions.countdown && !timeOptions.target)) &&
    !document.hidden
  )
    void refreshSchedule();
};

if (page === 'dashboard' && content) {
  document.addEventListener('visibilitychange', refreshVisibleSchedule);
  const refreshTimer = setInterval(refreshVisibleSchedule, 5 * 60000);

  window.addEventListener(
    'pagehide',
    () => {
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', refreshVisibleSchedule);
    },
    { once: true },
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (
    changes.dashboard ||
    changes.loginTheme ||
    changes.timeOptions ||
    changes.lessonCache ||
    changes.dashboardLayout ||
    changes.navigationLayout
  ) {
    revision++;

    if (changes.navigationLayout)
      navigationLayout = parseDashboardLayout(changes.navigationLayout.newValue);
    if (changes.dashboardLayout)
      layout = parseDashboardLayout(changes.dashboardLayout.newValue);
    if (changes.timeOptions) timeOptions = parseTimeOptions(changes.timeOptions.newValue);
    if (changes.lessonCache) lessonCache = changes.lessonCache.newValue;
    if (changes.dashboard) dashboard = parseDashboard(changes.dashboard.newValue);
    if (changes.loginTheme) theme = parseSettings(changes.loginTheme.newValue);

    apply();
  }
});

const initialRevision = revision;

chrome.storage.local
  .get([
    'dashboard',
    'loginTheme',
    'timeOptions',
    'lessonCache',
    'dashboardLayout',
    'navigationLayout',
  ])
  .then((data) => {
    if (revision === initialRevision) {
      navigationLayout = parseDashboardLayout(data.navigationLayout);
      layout = parseDashboardLayout(data.dashboardLayout);
      timeOptions = parseTimeOptions(data.timeOptions);
      lessonCache = data.lessonCache;
      dashboard = parseDashboard(data.dashboard);
      theme = parseSettings(data.loginTheme);
    }

    apply();
  })
  .catch(() => apply());

const cleanupAccountWatch = watchStudentAccount(apply);
window.addEventListener(
  'pagehide',
  () => {
    cleanupAccountWatch();
    cleanupInbox?.();
    cleanupWhatsNew?.();
  },
  { once: true },
);
