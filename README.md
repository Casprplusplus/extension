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

## Backend configuration

Builds connect to `https://api.casprplusplus.be` by default. Set the
`BACKEND_URL` environment variable to use your own server. The build embeds
this address and adds its origin to the generated manifest's host permissions.
Use an origin only: protocol, hostname and optional port, without a path,
query string or credentials.

For a local backend on Windows PowerShell:

```powershell
$env:BACKEND_URL = 'http://127.0.0.1:4201'
npm run build:test
```

On Linux or macOS:

```sh
BACKEND_URL=http://127.0.0.1:4201 npm run build:test
```

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
