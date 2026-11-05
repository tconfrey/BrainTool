// Launches Chromium with the unpacked extension loaded and the app open in its own window.
// Dev-only; used by tests/extension/sessionManager.test.js, which tests/run.js calls.
//
// - The extension is copied to a temp dir so config.js (gitignored; it holds the real keys)
//   can be supplied from configFallback.js, and so the content-script match can follow PORT.
// - Extensions need Chromium's "new" headless mode (channel 'chromium'); the default
//   chromium-headless-shell can't load them. Set HEADED=1 to watch (needs a display or xvfb-run).
// - Storage is chrome.storage.local, the path the app uses when no GDrive or local file is
//   connected: we seed BTFileText (the org text) and Config before the app launches, and read
//   BTFileText back to check what the app saved. No app code is changed for the tests.
// - The network is mocked: app/index.html pulls jQuery and jQuery UI from CDNs, which are
//   served from node_modules instead (index.html's SRI attributes are stripped, since npm's
//   jQuery is 3.7.1 rather than the CDN's 3.4.1). Every other external request is aborted.

import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function prepareExtension(port) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-ext-'));
    fs.cpSync(path.join(ROOT, 'extension'), dir, { recursive: true });
    if (!fs.existsSync(path.join(dir, 'config.js')))
        fs.copyFileSync(path.join(dir, 'configFallback.js'), path.join(dir, 'config.js'));
    const manifestPath = path.join(dir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const match = manifest.content_scripts[0].matches[0];
    if (!match.startsWith('http://localhost:'))
        throw new Error(`extension/manifest.json is not the dev manifest (content script matches ${match})`);
    manifest.content_scripts[0].matches = [`http://localhost:${port}/app/*`];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return dir;
}

async function mockNetwork(context, port) {
    const local = `http://localhost:${port}/`;
    await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('https://code.jquery.com/jquery-'))
            return route.fulfill({ path: path.join(ROOT, 'node_modules/jquery/dist/jquery.min.js'),
                                   contentType: 'text/javascript' });
        if (url.startsWith('https://ajax.googleapis.com/ajax/libs/jqueryui/'))
            return route.fulfill({ path: path.join(ROOT, 'node_modules/jquery-ui-dist/jquery-ui.min.js'),
                                   contentType: 'text/javascript' });
        // sidePanel.html points its iframe at the bare app/ directory; tests/server.js has no index pages
        if ([`${local}app/index.html`, `${local}app/`].includes(url.split(/[?#]/)[0])) {
            const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8')
                  .replace(/\s(integrity|crossorigin)="[^"]*"/g, '');
            return route.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
        }
        if (url.startsWith(local) || !url.startsWith('http')) return route.continue();
        return route.abort();
    });
}

export async function launchExtension({ port = 8000, orgText, config = {} } = {}) {
    const extDir = prepareExtension(port);
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-profile-'));
    const headed = !!process.env.HEADED;
    const context = await chromium.launchPersistentContext(profileDir, {
        headless: !headed,
        channel: headed ? undefined : 'chromium',
        viewport: { width: 1000, height: 1100 },
        args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    });
    await mockNetwork(context, port);

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });

    // onInstalled opens a welcome tab on braintool.org (aborted by the mock). Wait for it so the
    // tests can close it along with the startup window; see closeOtherWindows.
    await waitFor(() => sw.evaluate(async () =>
        (await chrome.tabs.query({})).some(t => (t.pendingUrl || t.url).includes('braintool.org'))), 10000)
        .catch(() => {});
    await sw.evaluate(async ({ orgText, config }) => {
        await chrome.storage.local.set({ BTFileText: orgText, Config: config });
    }, { orgText, config });

    const cleanup = () => {
        fs.rmSync(extDir, { recursive: true, force: true });
        fs.rmSync(profileDir, { recursive: true, force: true });
    };
    return { context, sw, cleanup };
}

export async function openApp(context, sw, port = 8000) {
    // Open the app in a window of its own: the session tree leaves out the app's window.
    // The window starts on about:blank and is then navigated by Playwright, because request
    // routing doesn't catch a navigation that starts before Playwright attaches to the page.
    const pageP = context.waitForEvent('page', p => p.url().includes('#bt-app'));
    await sw.evaluate(() => chrome.windows.create({ url: 'about:blank#bt-app' }));
    const page = await pageP;
    await page.goto(`http://localhost:${port}/app/index.html`);

    // On first launch the background's initializeExtension opens a second welcome tab, in the
    // app's window. That leaves the app a background tab, which renders at about 1fps, and every
    // Playwright mouse event waits for a frame. Close the welcome tabs and re-activate the app.
    await waitFor(() => welcomeTabs(sw).then(ids => ids.length), 10000).catch(() => {});
    await sw.evaluate(ids => chrome.tabs.remove(ids), await welcomeTabs(sw));
    await page.bringToFront();
    return page;
}

function welcomeTabs(sw) {
    return sw.evaluate(async () => (await chrome.tabs.query({}))
                       .filter(t => (t.pendingUrl || t.url).includes('braintool.org')).map(t => t.id));
}

export async function closeOtherWindows(sw, keepWindowIds) {
    // Close every window but the given ones, eg the startup window and the welcome tab
    await sw.evaluate(async keep => {
        for (const w of await chrome.windows.getAll())
            if (!keep.includes(w.id)) await chrome.windows.remove(w.id);
    }, keepWindowIds);
}

export async function waitFor(fn, timeout = 10000, what = '') {
    // Poll fn until it returns something truthy, or throw after timeout ms. `what` names the
    // condition in the error.
    const interval = 100;
    const end = Date.now() + timeout;
    let last;
    for (;;) {
        try {
            last = await fn();
            if (last) return last;
        } catch (e) { last = e; }
        if (Date.now() > end)
            throw new Error(`timed out after ${timeout}ms` + (what ? ` waiting for ${what}` : '') +
                            (last instanceof Error ? `: ${last.message}` : ''));
        await new Promise(r => setTimeout(r, interval));
    }
}
