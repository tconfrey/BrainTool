// End-to-end checks of the real extension + app: messaging plumbing and the Session Manager
// (the "Testing checklist" under the Session DnD sections of resources/BrainToolDesign.org).
// Run by tests/run.js (npm test, or npm run test:ext for just these). Dev-only.
//
// One browser session runs the checks in order; later checks build on the state earlier ones
// leave (eg re-filing needs the tab saved by the drag before it), so a failure can cascade.
// Each check prints ✔/✖; the first failure's later dependents are still attempted.
//
// Drags are real mouse drags (Playwright mouse events drive jQuery UI's draggable/droppable,
// the same code path a user hits). Assertions read the DOM rows, the org text the app saved to
// chrome.storage.local, and the browser's tabs/groups via the extension's service worker.

import { launchExtension, openApp, closeOtherWindows, waitFor } from './harness.js';

const page = (port, name) => `http://localhost:${port}/tests/extension/pages/${name}.html`;

const SEED = port => `* Alpha
** [[${page(port, 'a1')}][A1]]
* Beta
** [[${page(port, 'b1')}][B1]]
** [[${page(port, 'b2')}][B2]]
* Gamma
`;

// Saved without intro slides or upgrade messages so no overlay covers the tree
const CONFIG = { BTDontShowIntro: true, BTLastShownMessageIndex: 999, BTShowSession: 'SHOWN' };

function check(cond, msg) {
    if (!cond) throw new Error(msg);
}

export async function runExtensionTests(port = 8000) {
    const results = [];
    const pageErrors = [];
    let ctx, sw, app, cleanup;
    const t0 = Date.now();

    // ---- helpers bound to this session ----
    const orgText = () => sw.evaluate(async () => (await chrome.storage.local.get('BTFileText')).BTFileText || '');
    const config = () => sw.evaluate(async () => (await chrome.storage.local.get('Config')).Config || {});
    const tabs = () => sw.evaluate(() => chrome.tabs.query({}));
    const tabByName = async name => (await tabs()).find(t => (t.url || t.pendingUrl || '').endsWith(`/${name}.html`));
    const group = id => sw.evaluate(id => chrome.tabGroups.get(id), id);

    // Rows by title: a string matches the whole title, a RegExp is used as is
    const title = t => (t instanceof RegExp) ? t : new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const row = (cls, t) => app.locator(`#content tr${cls}`)
          .filter({ has: app.locator('span.btTitleText', { hasText: title(t) }) });
    const sessionRow = t => row('.sessionNode', t);
    const appRow = t => row(':not(.sessionNode)', t);
    const sessionRoot = () => sessionRow(/CURRENT SESSION$/);
    const windowRow = () => sessionRow(/^Window \d+/);
    async function openSettings() {
        if (!await app.locator('#settings').isVisible()) await app.locator('#settingsButton').click();
        await app.locator('#settingsSessionOn').waitFor({ state: 'visible' });
    }
    async function closeSettings() {
        if (await app.locator('#settings').isVisible()) await app.locator('#settingsButton').click();
        await app.locator('#content').waitFor({ state: 'visible' });
        await app.waitForTimeout(300);                      // slide/fade animations
    }
    const rowId = async loc => Number(await loc.getAttribute('data-tt-id'));
    const parentId = async loc => Number(await loc.getAttribute('data-tt-parent-id'));
    const rowCount = () => app.locator('#content tr').count();

    async function orgHas(re, timeout = 12000) {
        // saveBT is debounced up to 5s, so poll the stored text
        return waitFor(async () => re.test(await orgText()), timeout)
            .catch(async () => { throw new Error(`org file never matched ${re}:\n${await orgText()}`); });
    }
    async function sectionHas(heading, re, timeout = 12000) {
        // the "* heading" section of the saved org file matches re (polled, saves are debounced)
        return waitFor(async () => re.test(sectionOf(await orgText(), heading)), timeout)
            .catch(async () => { throw new Error(`* ${heading} never matched ${re}:\n${await orgText()}`); });
    }
    function sectionOf(org, heading) {
        // the non-blank lines of a top level "* heading" section, up to the next top level heading
        const lines = org.split('\n');
        const start = lines.findIndex(l => l === `* ${heading}` || l.startsWith(`* ${heading} `));
        if (start < 0) return '';
        const end = lines.findIndex((l, i) => i > start && /^\* /.test(l));
        return lines.slice(start, end < 0 ? undefined : end).filter(l => l.trim()).join('\n');  // nodes are separated by blank lines
    }

    async function drag(from, to, { offsetY = 0 } = {}) {
        // Real mouse drag of row `from` onto row `to`. jQuery UI's draggable waits 100ms and 5px
        // before starting; droppable picks the row the helper overlaps by half (tolerance intersect).
        await from.scrollIntoViewIfNeeded();
        const a = await from.boundingBox();
        await app.mouse.move(a.x + 40, a.y + a.height / 2);
        await app.mouse.down();
        await app.waitForTimeout(150);
        await app.mouse.move(a.x + 40, a.y + a.height / 2 + 8, { steps: 2 });
        const b = await to.boundingBox();
        await app.mouse.move(a.x + 40, b.y + b.height / 2 + offsetY, { steps: 15 });
        await app.waitForTimeout(150);
        await app.mouse.up();
        await app.waitForTimeout(300);
    }

    async function settle(ms = 1200) {
        // let the browser events -> syncBrowserSnapshot -> syncToBrowser round trip finish
        await app.waitForTimeout(ms);
    }

    async function test(name, fn) {
        const start = Date.now();
        try {
            await fn();
            results.push({ name, ok: true, ms: Date.now() - start });
        } catch (e) {
            results.push({ name, ok: false, ms: Date.now() - start, error: e.message });
        }
    }

    try {
        ({ context: ctx, sw, cleanup } = await launchExtension({ port, orgText: SEED(port), config: CONFIG }));

        // Test window: one ungrouped tab, plus a "Research" group of two
        const testWin = await sw.evaluate(async urls => {
            const w = await chrome.windows.create({ url: urls });
            const ts = await chrome.tabs.query({ windowId: w.id });
            const g = await chrome.tabs.group({ tabIds: [ts[1].id, ts[2].id], createProperties: { windowId: w.id } });
            await chrome.tabGroups.update(g, { title: 'Research', color: 'blue' });
            return w.id;
        }, [page(port, 'one'), page(port, 'two'), page(port, 'three')]);
        await closeOtherWindows(sw, [testWin]);
        await waitFor(async () => (await tabs()).filter(t => t.status === 'complete').length === 3);

        app = await openApp(ctx, sw, port);
        app.on('pageerror', e => pageErrors.push(e.message));
        app.on('dialog', d => { pageErrors.push(`unexpected ${d.type()}: ${d.message()}`); d.dismiss(); });

        // ------------------------------------------------------------------ plumbing
        await test('plumbing: background -> content script -> app (launchApp renders the seeded org file)', async () => {
            await waitFor(() => appRow('Alpha').count(), 15000, 'the seeded topics to render');
            for (const t of ['Alpha', 'A1', 'Beta', 'B1', 'B2', 'Gamma'])
                check(await appRow(t).count() === 1, `no row for ${t}`);
        });

        await test('plumbing: app -> content script -> background AWAIT round trip', async () => {
            const rsp = await app.evaluate(() => new Promise(resolve => {
                window.addEventListener('message', function h(e) {
                    if (e.data?.type !== 'AWAIT_RESPONSE') return;
                    window.removeEventListener('message', h);
                    resolve(e.data.response);
                });
                window.postMessage({ function: 'syncBrowserSnapshot', type: 'AWAIT' }, '*');
            }));
            check(rsp?.status === 'success', `background answered ${JSON.stringify(rsp)}`);
        });

        await test('plumbing: app -> chrome.storage.local (localStore relay records the app tab)', async () => {
            const cfg = await waitFor(async () => { const c = await config(); return c.BTAppVersion && c; });
            const bt = await sw.evaluate(() => chrome.storage.local.get(['BTTab', 'BTWin']));
            check(bt.BTTab > 0 && bt.BTWin > 0, `BTTab/BTWin not set: ${JSON.stringify(bt)}`);
            check(cfg.BTAppVersion, 'app never wrote Config back');
        });

        // ------------------------------------------------------------------ session tree
        await test('session: open windows, tabs and tab groups appear in the session tree', async () => {
            await waitFor(() => sessionRoot().count());
            const win = windowRow();
            await waitFor(async () => await win.count() === 1);
            check(await parentId(win) === await rowId(sessionRoot()), 'window row not under session root');
            const winId = await rowId(win);
            const one = sessionRow('Page One'), grp = sessionRow('Research');
            await waitFor(async () => await one.count() === 1 && await grp.count() === 1);
            check(await parentId(one) === winId, 'Page One not under the window row');
            check(await parentId(grp) === winId, 'Research group not under the window row');
            check(/tgblue/.test(await grp.getAttribute('class')), 'group row missing its blue color');
            for (const t of ['Page Two', 'Page Three'])
                check(await parentId(sessionRow(t)) === await rowId(grp), `${t} not under Research`);
            check(await app.locator('#content tr.sessionNode a[href*="/app/index.html"]').count() === 0,
                  "app's own tab shown in the session");
        });

        await test('session: tree follows the browser (tab opened, then closed)', async () => {
            const t = await sw.evaluate(async ([w, url]) => chrome.tabs.create({ windowId: w, url }), [testWin, page(port, 'six')]);
            await waitFor(() => sessionRow('Page Six').count());
            await sw.evaluate(id => chrome.tabs.remove(id), t.id);
            await waitFor(async () => await sessionRow('Page Six').count() === 0);
        });

        // ------------------------------------------------------------------ DnD: session -> topics
        await test('drag unsaved tab onto a topic saves it (new link under the topic, tab grouped as the topic)', async () => {
            await drag(sessionRow('Page One'), appRow('Alpha'));
            const saved = appRow('Page One');
            await waitFor(() => saved.count(), 10000, 'a saved Page One row');
            check(await parentId(saved) === await rowId(appRow('Alpha')), 'saved link not under Alpha');
            check(await sessionRow('Page One').count() === 1, 'session row should stay (save is a copy)');
            await sectionHas('Alpha', /^\*\* \[\[.*\/one\.html\]\[Page One\]\]$/m);
            const tab = await waitFor(async () => { const t = await tabByName('one'); return t.groupId > 0 && t; });
            check((await group(tab.groupId)).title === 'Alpha', 'tab not wrapped in a group named Alpha');
        });

        await test('drag unsaved tab group onto a topic saves it (subtopic + leaves; browser untouched)', async () => {
            const before = await tabByName('two');
            await drag(sessionRow('Research'), appRow('Beta'));
            const topic = appRow('Research');
            await waitFor(() => topic.count(), 10000, 'a saved Research topic row');
            check(await parentId(topic) === await rowId(appRow('Beta')), 'Research topic not under Beta');
            for (const t of ['Page Two', 'Page Three'])
                await waitFor(async () => await parentId(appRow(t)) === await rowId(topic));
            await sectionHas('Beta', /^\*\* Research.*\n(.*\n)*\*\*\* \[\[.*\/two\.html\]\[Page Two\]\]\n\*\*\* \[\[.*\/three\.html\]\[Page Three\]\]/m);
            await settle();
            const after = await tabByName('two');
            check(after.groupId === before.groupId && after.windowId === before.windowId && after.index === before.index,
                  'browser tab was moved/regrouped');
            check((await group(after.groupId)).title === 'Research', 'browser group renamed');
            check(/tgblue/.test(await topic.getAttribute('class')), 'new topic missing the group color');
        });

        await test('re-file an already saved tab: its link moves to the new topic, no duplicate', async () => {
            await drag(sessionRow('Page One'), appRow('Gamma'));
            await waitFor(async () => await parentId(appRow('Page One')) === await rowId(appRow('Gamma')), 10000,
                          'Page One to move under Gamma');
            check(await appRow('Page One').count() === 1, 'duplicate link created');
            await sectionHas('Gamma', /^\*\* \[\[.*\/one\.html\]\[Page One\]\]$/m);
            const org = await orgText();
            check(!/one\.html/.test(sectionOf(org, 'Alpha')), 'link still under Alpha in the org file');
        });

        await test('drag a window row onto a topic is rejected (reverts, nothing saved)', async () => {
            const n = await rowCount(), org = await orgText();
            await drag(windowRow(), appRow('Alpha'));
            await settle();
            check(await rowCount() === n, 'rows changed');
            check(await orgText() === org, 'org file changed');
        });

        // ------------------------------------------------------------------ top level rule
        // A drop below a collapsed top level topic lands at the top level (determineDropBehavior)
        await test('dropping a link at top level is rejected (session tab and app link)', async () => {
            await sw.evaluate(async ([w, url]) => chrome.tabs.create({ windowId: w, url }), [testWin, page(port, 'four')]);
            await waitFor(() => sessionRow('Page Four').count());
            await settle();
            await app.locator(`#content tr[data-tt-id="${await rowId(appRow('Alpha'))}"] a.indenter, ` +
                              `#content tr[data-tt-id="${await rowId(appRow('Alpha'))}"] .indenter a`).first().click();
            await waitFor(async () => /collapsed/.test(await appRow('Alpha').getAttribute('class')));
            await sectionHas('Alpha', /:VISIBILITY: folded/);       // fold state is saved too; let it land
            await app.waitForTimeout(5500);
            const n = await rowCount(), org = await orgText();
            await drag(sessionRow('Page Four'), appRow('Alpha'));
            await settle();
            check(await appRow('Page Four').count() === 0, 'session tab saved at top level');
            await drag(appRow('B1'), appRow('Alpha'));
            await settle();
            check(await parentId(appRow('B1')) === await rowId(appRow('Beta')), 'app link moved to top level');
            check(await rowCount() === n, 'rows changed');
            check(await orgText() === org, 'org file changed');
        });

        await test('a tab group or a topic dropped at top level is accepted', async () => {
            await sw.evaluate(async ([w, url]) => {
                const t = await chrome.tabs.create({ windowId: w, url });
                const g = await chrome.tabs.group({ tabIds: [t.id], createProperties: { windowId: w } });
                await chrome.tabGroups.update(g, { title: 'Reading', color: 'red' });
            }, [testWin, page(port, 'five')]);
            await waitFor(() => sessionRow('Reading').count());
            await settle();                                     // group create + rename = several resyncs
            await drag(sessionRow('Reading'), appRow('Alpha'));
            const topic = appRow('Reading');
            await waitFor(() => topic.count(), 10000, 'a saved Reading topic row');
            check(!(await topic.getAttribute('data-tt-parent-id')), 'Reading should be a top level topic');
            await orgHas(/^\* Reading/m);
            // and an app topic: move Gamma below collapsed Alpha
            await drag(appRow('Gamma'), appRow('Alpha'));
            await orgHas(/\* Alpha[^]*\n\* Gamma[^]*\n\* Beta/);
        });

        // ------------------------------------------------------------------ show/hide
        await test('Settings show/hide toggle (BTShowSession) hides, keeps hidden, and rebuilds the session', async () => {
            await openSettings();
            await app.locator('#settingsSessionOff').check();
            await waitFor(async () => await sessionRoot().count() === 0, 10000, 'the session tree to go');
            await waitFor(async () => (await config()).BTShowSession === 'HIDDEN', 10000, 'BTShowSession=HIDDEN');
            // browser activity mustn't bring it back while hidden
            const t = await sw.evaluate(async ([w, url]) => chrome.tabs.create({ windowId: w, url }), [testWin, page(port, 'six')]);
            await settle();
            check(await sessionRoot().count() === 0, 'session rebuilt while hidden');
            await sw.evaluate(id => chrome.tabs.remove(id), t.id);
            await app.locator('#settingsSessionOn').check();
            await waitFor(() => sessionRoot().count());
            await waitFor(() => sessionRow('Page Four').count());
            await waitFor(async () => (await config()).BTShowSession === 'SHOWN');
        });

        await test('deleting the session root closes the session view (not trashed, re-openable)', async () => {
            await closeSettings();
            const org = await orgText();
            await sessionRoot().click();
            await app.keyboard.press('Delete');
            await waitFor(async () => await app.locator('#content tr.sessionNode').count() === 0, 10000,
                          'the session rows to go');
            await waitFor(async () => (await config()).BTShowSession === 'HIDDEN');
            await settle();
            check(!/CURRENT SESSION/.test(await orgText()), 'session written to the org file');
            check(await orgText() === org, 'org file changed');
            await openSettings();
            check(await app.locator('#settingsSessionOff').isChecked(), 'Settings toggle still says shown');
            await app.locator('#settingsSessionOn').check();
            await waitFor(() => sessionRoot().count());
        });

        // ------------------------------------------------------------------ trash + undo
        await test('delete to Trash, then Alt+Z undo restores the node in place', async () => {
            await closeSettings();
            const b2 = appRow('B2');
            const beta = await rowId(appRow('Beta'));
            await b2.click();
            await app.keyboard.press('Delete');
            // Trash contents aren't written to the org file (orgTextwChildren skips them)
            const trash = appRow(/TRASH$/);
            await waitFor(async () => await trash.count() && await parentId(appRow('B2')) === await rowId(trash),
                          10000, 'B2 under the Trash row');
            check(/trashed/.test(await appRow('B2').getAttribute('class')), 'B2 row not marked trashed');
            await sectionHas('Beta', /^(?![^]*b2\.html)/);
            await app.keyboard.press('Alt+KeyZ');
            await waitFor(async () => await parentId(appRow('B2')) === beta, 10000, 'B2 back under Beta');
            check(!/trashed/.test(await appRow('B2').getAttribute('class')), 'B2 row still marked trashed');
            await sectionHas('Beta', /^\*\* \[\[.*\/b1\.html\]\[B1\]\]\n\*\* \[\[.*\/b2\.html\]\[B2\]\]\n\*\* Research/m);
        });

        // ------------------------------------------------------------------ reload
        await test('reload: the saved org file brings back every saved node, session rebuilt', async () => {
            await app.waitForTimeout(5500);                         // let any debounced save land
            const org = await orgText();
            await app.reload();
            await waitFor(() => appRow('Alpha').count(), 15000);
            for (const t of ['Page One', 'Research', 'Page Two', 'Page Three', 'Reading', 'B1', 'B2'])
                check(await appRow(t).count() === 1, `${t} missing after reload`);
            await waitFor(() => sessionRow('Page Four').count());
            check(org.length > 0, 'empty org file');
        });

        // ------------------------------------------------------------------ side panel page
        // chrome.sidePanel.open() needs a user gesture and headless Chromium has no side panel UI,
        // so load sidePanel.html as an ordinary tab: same page, same iframe + postMessage relay.
        await test('side panel page (sidePanel.html in a tab) launches the app in its iframe', async () => {
            await app.close();                                  // closing the app tab suspends the extension
            await waitFor(async () => !(await sw.evaluate(() => chrome.storage.local.get('BTTab'))).BTTab,
                          10000, 'the background to suspend (BTTab cleared)');
            const extId = new URL(sw.url()).host;
            const panel = await ctx.newPage();
            panel.on('pageerror', e => pageErrors.push(`sidePanel: ${e.message}`));
            await panel.goto(`chrome-extension://${extId}/sidePanel.html`);
            const frame = panel.frameLocator('#BTTopicManager');
            const frameRow = t => frame.locator('#content tr:not(.sessionNode)')
                  .filter({ has: frame.locator('span.btTitleText', { hasText: title(t) }) });
            await waitFor(() => frameRow('Research').count(), 15000, 'the app tree inside the side panel iframe');
            check(await frameRow('Page One').count() === 1, 'saved link missing in side panel');
            // and the way back: app (in the iframe) -> sidePanel.html's relay -> storage
            await waitFor(async () => (await config()).BTManagerHome === 'SIDEPANEL', 10000,
                          'the iframe app to store BTManagerHome=SIDEPANEL (app -> extension messages)');
        });
    } catch (e) {
        results.push({ name: 'harness setup', ok: false, error: e.stack || e.message });
    } finally {
        if (ctx) await ctx.close().catch(() => {});
        cleanup?.();
    }

    // ---- report, in the style of tests/run.js ----
    const failed = results.filter(r => !r.ok);
    const ok = failed.length === 0 && pageErrors.length === 0;
    console.log(`${ok ? '✔' : '✖'} extension (tests/extension): ${results.length - failed.length} passed, ` +
                `${failed.length} failed (${Date.now() - t0}ms)`);
    for (const r of results) {
        if (process.env.VERBOSE || !r.ok) console.log(`  ${r.ok ? "✔" : "✖"} ${r.name} (${r.ms ?? 0}ms)${r.ok ? "" : `\n      ${r.error.replace(/\n/g, '\n      ')}`}`);
    }
    pageErrors.forEach(e => console.log(`    page error: ${e}`));
    return ok;
}
