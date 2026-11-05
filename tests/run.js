// Headless test runner: serves the repo on localhost, loads each QUnit page in Chromium via
// Playwright, prints failures and exits non-zero if any test failed. Dev-only.
//
//   npm test                          run every page in PAGES
//   node tests/run.js tests/foo.html  run just the given page(s)
//
// To add a suite: create tests/<name>.html that loads QUnit from node_modules (see
// orgRoundTrip.html) and add it to PAGES. Pages need no reporting code; the runner hooks QUnit
// as it loads. QUnit.todo tests count as passing while they fail (that's the point of a todo).
// Set PORT to use a port other than 8000.
//
// First run on a new machine: npx playwright install chromium

import { chromium } from 'playwright';
import { startServer } from './server.js';

const PAGES = [
    'tests/orgRoundTrip.html',
    // tests/test.html is the old pre-ES-module suite; it needs the extension loaded, so it's
    // not run here yet.
];

const PORT = Number(process.env.PORT) || 8000;
const TIMEOUT_MS = 60000;

// Runs in the page before any of its scripts. Catches the moment qunit.js assigns
// window.QUnit and subscribes to its events.
function hookQUnit() {
    window.__results = { failures: [], done: null };
    let qunit;
    Object.defineProperty(window, 'QUnit', {
        configurable: true,
        get() { return qunit; },
        set(q) {
            qunit = q;
            q.on('testEnd', test => {
                if (test.status !== 'failed') return;
                window.__results.failures.push({
                    name: [...test.fullName].join(' > '),
                    errors: test.errors.map(e => ({ message: e.message, actual: e.actual,
                                                    expected: e.expected, stack: e.stack }))
                });
            });
            q.on('runEnd', run => { window.__results.done = run; });
        }
    });
}

function show(value) {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function runPage(browser, page) {
    const tab = await browser.newPage();
    const pageErrors = [];
    tab.on('pageerror', e => pageErrors.push(e.message));
    await tab.addInitScript(hookQUnit);
    await tab.goto(`http://localhost:${PORT}/${page}`);
    try {
        await tab.waitForFunction(() => window.__results.done, null, { timeout: TIMEOUT_MS });
    } catch {
        console.log(`✖ ${page}: QUnit did not finish within ${TIMEOUT_MS / 1000}s`);
        pageErrors.forEach(e => console.log(`    page error: ${e}`));
        await tab.close();
        return false;
    }
    const { failures, done } = await tab.evaluate(() => window.__results);
    await tab.close();

    const c = done.testCounts;
    const ok = done.status === 'passed' && pageErrors.length === 0;
    console.log(`${ok ? '✔' : '✖'} ${page}: ${c.passed} passed, ${c.failed} failed, ` +
                `${c.todo} todo, ${c.skipped} skipped (${done.runtime}ms)`);
    for (const f of failures) {
        console.log(`\n  ✖ ${f.name}`);
        for (const e of f.errors) {
            console.log(`    ${e.message || 'assertion failed'}`);
            if (e.expected !== undefined || e.actual !== undefined) {
                console.log(`    expected:\n${show(e.expected)}`);
                console.log(`    actual:\n${show(e.actual)}`);
            }
        }
    }
    pageErrors.forEach(e => console.log(`    page error: ${e}`));
    return ok;
}

const pages = process.argv.slice(2).length ? process.argv.slice(2) : PAGES;
const server = await startServer(PORT);
const browser = await chromium.launch();
let allOk = true;
try {
    for (const page of pages) allOk = (await runPage(browser, page)) && allOk;
} finally {
    await browser.close();
    server.close();
}
process.exit(allOk ? 0 : 1);
