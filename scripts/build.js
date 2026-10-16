import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'extension');
const watchMode = process.argv.includes('--watch');
const allowHttp = process.argv.includes('--allow-http');
const publicBuild = process.argv.includes('--public');
const testBackend = process.argv.includes('--test-backend');
const devBuild = !publicBuild && (watchMode || process.argv.includes('--dev'));
const backendUrl = new URL(
  process.env.BACKEND_URL ||
    (testBackend
      ? 'http://127.0.0.1:3000'
      : devBuild || publicBuild
        ? 'https://dev-api.casprplusplus.be'
        : 'https://api.casprplusplus.be'),
);

if (!['https:', 'http:'].includes(backendUrl.protocol)) {
  throw new Error('BACKEND_URL must use HTTPS or HTTP.');
}

if (
  backendUrl.username ||
  backendUrl.password ||
  backendUrl.search ||
  backendUrl.hash ||
  backendUrl.pathname !== '/'
) {
  throw new Error(
    'BACKEND_URL must contain only the protocol, hostname and optional port.',
  );
}

if (backendUrl.protocol === 'http:' && (!allowHttp || publicBuild)) {
  throw new Error('HTTP requires npm run build:test. Public builds require HTTPS.');
}

const backendOrigin = backendUrl.origin;
const entryPoints = {
  background: 'src/background-scripts/index.ts',
  'dashboard-theme': 'src/content/dashboard.ts',
  'login-theme': 'src/content/login.ts',
  'schedule-capture': 'src/content/schedule.ts',
  popup: 'src/popup/index.ts',
  'dashboard-theme-style': 'src/styles/dashboard-theme.css',
  'login-theme-style': 'src/styles/login-theme.css',
  'popup-style': 'src/styles/popup.css',
};

async function copyTemplates() {
  const manifest = JSON.parse(
    await readFile(resolve(projectRoot, 'templates/manifest.json'), 'utf8'),
  );
  manifest.host_permissions = [
    ...new Set([
      ...manifest.host_permissions.filter(
        (permission) => permission !== 'https://api.casprplusplus.be/*',
      ),
      `${backendOrigin}/*`,
    ]),
  ];

  await mkdir(outputDirectory, { recursive: true });
  await cp(resolve(projectRoot, 'templates/assets'), resolve(outputDirectory, 'assets'), {
    recursive: true,
  });
  await cp(
    resolve(projectRoot, 'templates/popup.html'),
    resolve(outputDirectory, 'popup.html'),
  );

  for (const file of ['privacy.html', 'privacy.css']) {
    await cp(resolve(projectRoot, 'templates', file), resolve(outputDirectory, file));
  }

  await cp(resolve(projectRoot, 'LICENSE'), resolve(outputDirectory, 'LICENSE'));

  await writeFile(
    resolve(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

async function buildExtension() {
  await build({
    absWorkingDir: projectRoot,
    entryPoints,
    outdir: outputDirectory,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    minify: !watchMode,
    sourcemap: watchMode,
    define: { __BACKEND_URL__: JSON.stringify(backendOrigin) },
    logLevel: 'info',
  });

  const manifest = await copyTemplates();
  const manifestFiles = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((script) => [
      ...(script.js || []),
      ...(script.css || []),
    ]),
    ...manifest.web_accessible_resources.flatMap((resource) => resource.resources),
    'popup.js',
    'popup-style.css',
  ];

  for (const file of new Set(manifestFiles)) {
    await access(resolve(outputDirectory, file));
  }

  console.log(`Extension built in ${outputDirectory}`);
}

await buildExtension();

if (watchMode) {
  let building = false;
  let pending = false;
  let debounce;

  async function rebuild() {
    if (building) {
      pending = true;
      return;
    }

    building = true;
    try {
      await buildExtension();
    } catch (error) {
      console.error('Extension build failed:', error);
    } finally {
      building = false;
      if (pending) {
        pending = false;
        void rebuild();
      }
    }
  }

  for (const directory of ['src', 'templates']) {
    watch(resolve(projectRoot, directory), { recursive: true }, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void rebuild(), 100);
    });
  }

  console.log('Watching source files, templates and privacy files for changes.');
}
