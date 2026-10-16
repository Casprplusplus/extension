# CASPR++ Extension

**Your school day, your style.**

CASPR++ adds themes, dashboard widgets and chat to CASPR in Chrome and Edge.
It is intended exclusively for students of **Broederschool** and is configured
for the school's CASPR environment at `https://kolvw.caspr.be`.

This is an independent community project, not an official CASPR release.

## Features

- Login and dashboard themes, glass effects and appearance settings.
- Widgets for your timetable, next lesson, grades and focus timer.
- Global chat, class chat, private messages and friend requests.
- Private groups, tasks, polls, reactions, replies and mentions.
- Moderation, notifications and account activation through the backend.
- A panic shortcut to disable the extension's visual changes.

Chat and community features require a compatible CASPR++ backend. The backend
is maintained in a separate repository; it is not needed to build this project.

## Build and install

You need Node.js 20.15 or newer and npm. Run from the repository root:

```sh
npm ci
npm run build
```

The complete extension is generated in **`extension/`**.

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project's `extension/` directory.
4. Open CASPR and refresh the page.
5. Open the extension popup to adjust your settings.

After rebuilding, reload the extension in the browser and refresh CASPR.
Edit source files in `src/` and `templates/`; generated files in
`extension/` will be overwritten by subsequent builds.

## Theme Studio

Open **Instellingen → Theme Studio openen** on your CASPR dashboard. Customize
colors, fonts, solid or gradient backgrounds, photos, glass blur, card opacity,
rounded corners and shadows. Changes preview immediately on the page; choose
**Toepassen** to use them on the dashboard and login screen. Closing the studio
without applying restores the previous theme.

Six presets are included. Save up to 20 personal themes, duplicate or delete them,
and export individual themes as JSON. Imports preview before applying and contain
only appearance settings and an optional embedded background photo. Photos are
resized locally; no external font or image service is needed. Use
**Standaardtheme herstellen** to return to the existing theme settings.

## Start screen Studio

Use **Startscherm aanpassen** above your dashboard. Arrange existing school tiles
and widgets with **Verslepen aanzetten**, or use the editor's arrow buttons.
Set each card's width and height (1–4), toggle its frame or hide it. Add personal
text, locally uploaded images and HTTP/HTTPS shortcuts. Hidden cards remain in
the editor so they can be restored. **Schoolwidgets toevoegen** enables built-in
widgets disabled in your previous settings.

Changes save locally. Undo/redo keeps the last 30 changes during the editor
session. Save up to 12 named layouts and switch between them. Export a complete
design as JSON with the layout, custom elements and current Studio theme;
imports require confirmation. School grades, schedules, chat messages and
accounts are not included. Personal text and images you add are included.
**Standaard herstellen** restores the default card arrangement without deleting
your saved layouts or theme. Smaller screens automatically stack the cards.

## Backend configuration

Development builds (`npm run build:dev` and `npm run dev`) connect to
`https://dev-api.casprplusplus.be` by default. Public builds (`npm run build:public`)
also use this backend for release 1.3.0, keeping existing users on the production
backend separate. Normal builds (`npm run build`) connect to
`https://api.casprplusplus.be`. Set the
`BACKEND_URL` environment variable to use your own server. The build embeds
this address and adds its origin to the generated manifest's host permissions.
Use an origin only: protocol, hostname and optional port, without a path,
query string or credentials.

For a local backend on Windows PowerShell:

```powershell
$env:BACKEND_URL = 'http://127.0.0.1:3000'
npm run build:test
```

On Linux or macOS:

```sh
BACKEND_URL=http://127.0.0.1:3000 npm run build:test
```

Without `BACKEND_URL`, `npm run build:test` connects to `http://127.0.0.1:3000`,
the Java backend's default port. Start it from `../CasprppBackend` with
`java -jar Spring/target/Spring-1.0-SNAPSHOT.jar`.
Java's optional `--test` mode uses port 4201; set `BACKEND_URL` explicitly for that mode.
For a remote test server, use your own host:
`ssh -N -L 3000:127.0.0.1:3000 user@your-vps`.

HTTP is accepted only with `build:test`. Normal and public builds require
HTTPS. Run `Remove-Item Env:BACKEND_URL` in PowerShell, or
`unset BACKEND_URL` in a POSIX shell, to return to the default address.

The extension uses Manifest V3. Its manifest includes access to the school's
CASPR pages, the configured backend and GIPHY. Review `templates/manifest.json`
when changing permissions or adapting the extension to another environment.

## Development

```sh
npm run dev           # Watch source and templates; include source maps
npm run check         # TypeScript type checking
npm run format        # Format supported files with Prettier
npm run format:check  # Check formatting
npm run build:public  # Build a minified extension using HTTPS
npm run validate      # Formatting, TypeScript and public build checks
```

For HTTP during development, set `BACKEND_URL` and run
`npm run dev -- --allow-http`. Reload the browser extension after each rebuild.

The current checks cover formatting, types and build output. There is no
standalone automated browser test suite, so changes to behavior should also be
checked in Chrome or Edge. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project structure

```text
src/
  background-scripts/  Service worker and backend communication
  content/             CASPR page entrypoints and data capture
  popup/               Extension settings
  widgets/             Dashboard, chat and community interfaces
  common/              Shared types, helpers and configuration
  games/               Game code
  styles/              Login, dashboard and popup styling
scripts/               Build tooling
templates/             Manifest, popup, logo and privacy page
extension/             Generated browser extension; excluded from Git
```

## Panic shortcut

Press **Ctrl+Shift+X** on Windows/Linux or **Command+Shift+X** on macOS to
turn off the visual customizations. Preferences remain stored locally.
You can adjust the shortcut at `chrome://extensions/shortcuts` or
`edge://extensions/shortcuts`.

## Contributing

Bug reports and focused pull requests are welcome. Follow
[CONTRIBUTING.md](CONTRIBUTING.md), use the shared Prettier configuration and
include the checks you performed. Use fictitious account data in reports and
screenshots.

## License

Licensed under the [GNU Affero General Public License, version 3](LICENSE)
(`AGPL-3.0-only`). Dependencies retain their own licenses.

The extension connects to the Java backend over Socket.IO at `/socket.io`. WebSocket is preferred, with polling fallback. MCNettyIO is an internal backend connection and is not used by the browser.

## De Lijn-widget

De De Lijn-widget staat tussen de dashboardwidgets en kan via Startscherm Studio
worden verplaatst, verborgen of vergroot. Open **Halte & instellingen**, bewaar je
Open Data API-key lokaal en zoek een halte op naam of op het zescijferige
haltenummer. Met een optioneel lijnfilter (bijvoorbeeld `21, 82`) beperk je de lijst.
De widget toont maximaal vijf vertrekken en vernieuwt elke minuut wanneer de
pagina en widget zichtbaar zijn. Live tijden en dienstregelingstijden worden
onderscheiden; vertragingen en geschrapte ritten worden apart aangeduid.

De extensie haalt gegevens rechtstreeks op bij `api.delijn.be` via haar eigen
service worker. De CASPR++-backend is hiervoor niet nodig. De API-key wordt in
`chrome.storage.local` bewaard en niet ingebouwd in de distributie. Hiervoor is
hosttoegang tot `https://api.delijn.be/*` aan het manifest toegevoegd.

## NMBS-widget

De treinwidget gebruikt de publieke iRail API zonder API-key. Open **Station kiezen**,
zoek op stationsnaam en kies je vertrekstation. Het station wordt lokaal opgeslagen.
De widget toont vijf komende treinen met bestemming, verwachte vertrektijd, spoor,
spoorwijzigingen, vertraging en afschaffingen. De tijd op de kaart is inclusief
vertraging; de geplande tijd staat in de tooltip.

De extensie haalt de gegevens rechtstreeks op bij `https://api.irail.be/` via haar
service worker. Stations worden een dag gecachet, vertrekborden minstens dertig
seconden (of langer wanneer de API dat aangeeft). Automatisch verversen gebeurt
elke minuut, alleen wanneer de pagina en widget zichtbaar zijn. Bij een 429-antwoord
wacht de extensie minstens een minuut. De widget is via Startscherm Studio te
verplaatsen, vergroten of verbergen.

## Weerwidget

De weerwidget gebruikt Open-Meteo zonder API-key. Open **Plaats kiezen**, zoek je
gemeente en selecteer de juiste plaats. Je keuze wordt lokaal opgeslagen; er wordt
geen automatische locatiebepaling gebruikt. De kaart toont temperatuur,
gevoelstemperatuur, wind, neerslag en een verwachting voor drie dagen met minima,
maxima en neerslagkans. Weersgegevens worden vijftien minuten gecachet en alleen
ververst wanneer de pagina en widget zichtbaar zijn. De kaart is verplaatsbaar en
te verbergen via Startscherm Studio. Het gratis Open-Meteo-aanbod is bedoeld voor
niet-commercieel gebruik; zie https://open-meteo.com/en/terms.
