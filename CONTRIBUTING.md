# Contributing to CASPR++ Extension

Bug fixes, documentation improvements and focused pull requests are welcome.
Discuss larger features or permission changes in an issue before implementing
them.

## Development workflow

1. Fork and clone this repository.
2. Install Node.js 20.15 or newer and run `npm ci`.
3. Create a branch for your change.
4. Run `npm run dev` and load `extension/` as an unpacked extension.
5. Edit files in `src/` or `templates/`. Reload the extension and refresh CASPR
   after rebuilding.

For a custom or local backend, see the [README](README.md). A backend checkout
is not required for the build; the manifest, assets and privacy page live in
this repository.

## Formatting is required

Use the shared configuration in [`.prettierrc.json`](.prettierrc.json), with
the project's installed Prettier version:

```sh
npm run format
npm run format:check
```

The configuration uses two spaces, a preferred line width of 90 characters,
single quotes and trailing commas. `src/common/themes.ts` has an explicit
double-quote override. Let Prettier apply these rules rather than formatting
individual files according to personal preferences.

You may enable Prettier formatting on save in your editor. The npm check is
still required before opening a pull request. Review the diff after formatting
and avoid unrelated changes.

## Code conventions

- Use descriptive names and keep functions focused.
- Keep reusable types and helpers in `src/common/` and UI code in the relevant
  content, popup or widget modules.
- Preserve strict TypeScript checking. Avoid introducing `any` or suppressing
  type errors instead of fixing them.
- Keep user-facing messages consistent with the existing Dutch interface.
- Respect account boundaries when reading or storing student data. Never use
  another account's cached settings or chat sessions.
- Request new browser permissions only when needed and explain them in the PR.
- Coordinate backend changes when modifying Socket.IO events or payloads.

## Validate your changes

```sh
npm run validate
```

This checks formatting and TypeScript, then builds the public extension. The
build verifies that the files referenced by the manifest exist. It does not
test browser behavior; the old preview and test scripts are no longer present.

Check affected behavior in Chrome or Edge. For UI changes, check both light
and dark themes, keyboard interaction and the relevant page sizes. For chat
changes, test against a compatible backend. Include the checks and results in
your PR, and describe anything you could not verify.

## Pull requests

Explain the problem, what changes for the user and how you checked it. Link the
relevant issue if there is one. Update the README when commands, configuration
or installation steps change.

Do not commit generated `extension/` files, `.env` files, signing keys (`.pem`),
packaged extensions (`.crx`) or real student data. Use fictitious data in
screenshots and reproduction steps. Preserve `package-lock.json` and include
its changes when intentionally updating dependencies.

Contributions are governed by the repository's [AGPLv3 license](LICENSE).
