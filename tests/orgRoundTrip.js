/***
 *
 * Org round-trip tests: parse an org file into AllNodes, write it back out, compare.
 *
 * For each fixture the expected output is the original text run through a pipeline of
 * named transforms. Each transform is one known difference between what goes in and what
 * BrainTool writes out, and is tagged:
 *   NORMALISED - deliberate, or harmless and accepted. Asserted exactly, so any change
 *                in behaviour shows up as a failure.
 *   LOST       - looks like a bug. The expected output still includes the loss (so the
 *                main test locks in current behaviour), and a QUnit.todo asserts the
 *                original fragment survives. When someone fixes the bug the todo starts
 *                passing, QUnit reports that as a failure, and the fixer moves the entry.
 *
 * Every fixture also gets:
 *   - a second-round-trip test: saving the saved output again must not change it.
 *   - an import test: parser.insertOrgFile (Actions > Import org file) must produce the
 *     same subtree as the file-load path, one level deeper under the import topic.
 *
 ***/

import { loadAndSave, importAndSave, fetchText, AllNodes } from './orgHarness.js';

const BT_ORG_PROPS = ['BTCohort', 'BTVersion', 'BTId'];      // configManager Properties.orgProps, in order
const TAG_COLUMN = 77;                                        // BTAppNode.orgTags
const isHeading = line => /^\*+ /.test(line);
const stars = line => line.match(/^\*+/)[0].length;

/***
 * Transforms. Each takes and returns the whole file text.
 ***/

// NORMALISED: BrainTool only keeps its own file-level props (configManager orgProps) and writes
// them first, in a fixed order, with no blank line before the first heading. Other BT settings
// that older files carry (BTGroupingMode, BTFavicons) now live in browser storage, and
// BTParentTopic only matters at import time. Only the first contiguous block of #+PROPERTY
// lines is read (parser.parseBTFile).
// LOST: everything else before the first heading (free text, #+TITLE, #+TODO, #+STARTUP...).
// See the per-fixture todos.
function rebuildPreamble(text) {
    const firstHeading = text.search(/^\*+ /m);
    const pre = firstHeading < 0 ? text : text.slice(0, firstHeading);
    const body = firstHeading < 0 ? '' : text.slice(firstHeading);
    const block = /(^#\+PROPERTY: .*$\n)+/m.exec(text);
    const values = {};
    if (block) for (const m of block[0].matchAll(/PROPERTY: (.*?) (.*)/g)) values[m[1]] = m[2];
    let out = '';
    for (const p of BT_ORG_PROPS) if (values[p]) out += `#+PROPERTY: ${p} ${values[p]}\n`;
    return pre === text && !body ? out : out + body;
}

// NORMALISED: the tree has no gaps, so a heading that skips levels (* then ***) becomes a
// direct child of its parent (orgaSection sets level = parent.level + 1).
function closeLevelGaps(text) {
    const stack = [];                                         // [sourceStars, btLevel]
    return text.split('\n').map(line => {
        if (!isHeading(line)) return line;
        const n = stars(line);
        while (stack.length && stack[stack.length - 1][0] >= n) stack.pop();
        const level = stack.length ? stack[stack.length - 1][1] + 1 : n;
        stack.push([n, level]);
        return '*'.repeat(level) + line.slice(n);
    }).join('\n');
}

// NORMALISED: tags are right-aligned to column 77 (BTAppNode.orgTags), whatever the padding was.
function padTags(text) {
    return text.split('\n').map(line => {
        const m = isHeading(line) && line.match(/^(\*+ .*?)[ \t]+(:(?:[A-Za-z0-9_@#%]+:)+)[ \t]*$/);
        if (!m) return line;
        const pad = Math.max(TAG_COLUMN - m[1].length - m[2].length, 1);
        return m[1] + ' '.repeat(pad) + m[2];
    }).join('\n');
}

// NORMALISED: drawers are re-indented by two spaces and each property is written ":KEY: value"
// with one space (BTAppNode.orgDrawers), whatever the original alignment. :VISIBILITY: is only
// kept when folded.
// LOST: lines in a drawer that aren't ":KEY: value" (LOGBOOK clock lines, free text in custom
// drawers) are dropped. See the todos on drawers.org.
function normaliseDrawers(text) {
    let inDrawer = false;
    const out = [];
    for (const line of text.split('\n')) {
        if (!inDrawer && /^\s*:[\w-]+:\s*$/.test(line) && !/^\s*:END:\s*$/.test(line)) {
            inDrawer = true;
            out.push('  ' + line.trim());
        } else if (inDrawer && /^\s*:END:\s*$/.test(line)) {
            inDrawer = false;
            out.push('  :END:');
        } else if (inDrawer) {
            const m = line.match(/^\s*:([\w-]*):(.*)$/);
            if (m && m[1] === 'VISIBILITY')                   // only stored if folded, fixed format
                { if (/folded/.test(m[2])) out.push('  :VISIBILITY: folded'); }
            else if (m) out.push(`  :${m[1]}:` + (m[2].trim() ? ' ' + m[2].trim() : ''));
        } else {
            out.push(line);
        }
    }
    return out.join('\n');
}

// NORMALISED: children of the special topics are never written (BTAppNode.orgTextwChildren).
// The Trash is session-only and the Bookmarks Bar is re-synced from the browser on startup.
function dropSpecialTopicChildren(text) {
    const out = [];
    let specialLevel = 0, skipping = false;
    for (const line of text.split('\n')) {
        if (isHeading(line)) {
            skipping = specialLevel > 0 && stars(line) > specialLevel;
            if (!skipping)
                specialLevel = /^\*+ (🗑️ TRASH|🔖 BOOKMARKS BAR)\s*$/.test(line) ? stars(line) : 0;
        }
        if (!skipping) out.push(line);
    }
    return out.join('\n');
}

// NORMALISED (orga, not deliberate but harmless): leading whitespace on body text lines is
// stripped. parser.orgaText puts back one space before a line starting with '*' so it doesn't
// turn into a heading. List items, tables, blocks and drawers keep their raw text.
// Also, trailing whitespace after a link that ends a paragraph is dropped.
function bodyWhitespace(text) {
    const lines = text.split('\n');
    let inBlock = false, inDrawer = false;
    return lines.map((line, i) => {
        if (/^\s*#\+begin_/i.test(line)) inBlock = true;
        if (/^\s*#\+end_/i.test(line)) { inBlock = false; return line; }
        if (/^\s*:[\w-]+:\s*$/.test(line)) inDrawer = !/:END:/.test(line);
        if (inBlock || inDrawer || isHeading(line) || /^\s*:END:/.test(line)) return line;
        const t = line.trimStart();
        if (/^([-+|#:]|\d+[.)] )/.test(t) || t === '') return line;
        let out = t.startsWith('*') ? ' ' + t : t;
        const next = lines[i + 1];
        if (next === undefined || next.trim() === '' || isHeading(next)) out = out.replace(/\]\][ \t]+$/, ']]');
        return out;
    }).join('\n');
}

// NORMALISED: layout. Each node is written as heading, planning, drawers, body, and nodes are
// separated by exactly one blank line (BTAppNode.orgTextwChildren / generateOrgFile). Blank lines
// before or after body text go, and the file ends with a single newline.
// LOST: blank lines *between* body paragraphs also go (orgaSection joins paragraphs with a single
// "\n"), so two paragraphs come back as one. See the todos on headings.org and blocks.org.
function canonicalLayout(text) {
    const out = [];
    let inBlock = false;
    for (const line of text.split('\n')) {
        if (/^\s*#\+begin_/i.test(line)) inBlock = true;
        if (/^\s*#\+end_/i.test(line)) inBlock = false;
        if (!inBlock && line.trim() === '') continue;
        if (isHeading(line) && out.some(isHeading)) out.push('');
        out.push(line);
    }
    return out.join('\n') + '\n';
}

// Applied to every fixture, in this order, after any fixture-specific replacements.
const COMMON = [rebuildPreamble, dropSpecialTopicChildren, closeLevelGaps, normaliseDrawers,
                bodyWhitespace, padTags, canonicalLayout];

/***
 * Fixtures. `replace` holds fixture-specific differences as [from, to] string pairs, applied
 * before COMMON. `lost` lists fragments of the original that should survive but don't; each
 * becomes a QUnit.todo.
 ***/

const FIXTURES = [
    {
        file: 'fixtures/headings.org',
        lost: [
            ['Text before the first heading is dropped', 'Some text before the first heading.'],
            ['Blank line between body paragraphs is dropped, merging them into one paragraph',
             'Paragraph after a blank line.\n\nSecond paragraph after another blank line.'],
        ],
    },
    {
        file: 'fixtures/keywords.org',
        lost: [
            ['#+TODO keyword line (custom TODO states) is dropped', '#+TODO: TODO NEXT WAITING | DONE CANCELLED'],
        ],
    },
    {
        file: 'fixtures/drawers.org',
        lost: [
            ['LOGBOOK drawer contents are dropped', 'CLOCK: [2024-01-01 Mon 09:00]--[2024-01-01 Mon 10:30] =>  1:30'],
            ['Custom drawer free text is dropped', 'Free text inside a custom drawer.'],
        ],
    },
    {
        file: 'fixtures/links.org',
        replace: [
            ['[[https://example.com/no-desc]]', '[[https://example.com/no-desc][undefined]]'],
            ['[[file:/tmp/plain.txt]]', '[[file:/tmp/plain.txt][undefined]]'],
            ['[[https://example.org/b]]', '[[https://example.org/b][undefined]]'],
            ['[[*Links in body][self]]', '[[internal:*Links in body][self]]'],
        ],
        lost: [
            // BTNode/_orgTextToHTML rely on the [[url][desc]] form and display "undefined" as the
            // URL, so the fix is wider than the parser.
            ['Link without description gains a literal "[undefined]" description', '[[https://example.com/no-desc]]\n'],
            ['Heading search link [[*Heading]] is rewritten to [[internal:*Heading]]', '[[*Links in body][self]]'],
        ],
    },
    {
        file: 'fixtures/blocks.org',
        replace: [
            ['footnote[fn:1] and', 'footnote and'],
            ['\n[fn:1] The footnote definition.', ''],
        ],
        lost: [
            ['Footnote reference [fn:1] is dropped from body text', 'footnote[fn:1]'],
            ['Footnote definition is dropped', '[fn:1] The footnote definition.'],
        ],
    },
    {
        file: 'fixtures/settings.org',
        replace: [
            ['#+CAPTION: an in-section keyword\n', ''],
        ],
        lost: [
            ['#+TITLE is dropped', '#+TITLE: Settings fixture'],
            ['#+STARTUP is dropped', '#+STARTUP: overview'],
            ['#+FILETAGS is dropped', '#+FILETAGS: :fixture:'],
            ['Non-BrainTool #+PROPERTY lines are dropped', '#+PROPERTY: header-args :results silent'],
            ['Affiliated keyword inside a section (#+CAPTION) is dropped', '#+CAPTION: an in-section keyword'],
        ],
    },
    { file: 'fixtures/unicode.org' },
    { file: 'fixtures/braintool.org' },
    // Real files. app/BrainTool.org is the starter file every new user gets.
    { file: '../app/BrainTool.org' },
    { file: '../topicTrees/BrainTool.org' },
    { file: '../topicTrees/BrainTool-comparitors.org' },
    { file: '../topicTrees/EmacsAndOrg.org' },
    { file: '../topicTrees/PersonalProductivity.org' },
    { file: '../topicTrees/recipes.org' },
];

function expectedOutput(original, fixture) {
    let text = original;
    for (const [from, to] of fixture.replace || []) {
        if (!text.includes(from)) throw new Error(`${fixture.file}: replace target not found: ${from}`);
        text = text.replace(from, to);
    }
    for (const transform of COMMON) text = transform(text);
    return text;
}

function stripPreamble(text) {
    const i = text.search(/^\*+ /m);
    return i < 0 ? '' : text.slice(i);
}

QUnit.module('Org round trip', () => {
    for (const fixture of FIXTURES) {
        const name = fixture.file.replace(/^(\.\.\/)?/, '');

        QUnit.test(`${name}: save matches original plus documented normalisations`, async assert => {
            const original = await fetchText(fixture.file);
            const output = loadAndSave(original);
            assert.ok(AllNodes.length > 1, 'parsed some nodes');
            for (const [, fragment] of fixture.lost || [])     // keep the todos below honest
                assert.ok(original.includes(fragment), `lost fragment is in the fixture: ${fragment}`);
            assert.equal(output, expectedOutput(original, fixture));
        });

        (fixture.unstable ? QUnit.todo : QUnit.test)(
            `${name}: second round trip is stable` + (fixture.unstable ? ` - ${fixture.unstable}` : ''),
            async assert => {
                const once = loadAndSave(await fetchText(fixture.file));
                assert.equal(loadAndSave(once), once);
            });

        QUnit.test(`${name}: import gives the same subtree as load, under the import topic`, async assert => {
            const original = await fetchText(fixture.file);
            const loaded = stripPreamble(loadAndSave(original));
            const { parent } = importAndSave('Imported file', original);
            assert.ok(parent, 'import created a parent topic');
            const imported = parent.childIds.map(id => AllNodes[id].orgTextwChildren())
                  .filter(t => t.length).join('\n');
            // demoted below the import topic (deeper when the file names a BTParentTopic);
            // tags get re-aligned to the tag column
            const deeper = '*'.repeat(parent.level);
            assert.equal(imported, padTags(loaded.replace(/^\*/gm, deeper + '*')));
        });

        for (const [description, fragment] of fixture.lost || []) {
            QUnit.todo(`${name}: ${description}`, async assert => {
                const output = loadAndSave(await fetchText(fixture.file));
                assert.ok(output.includes(fragment), `output should contain: ${fragment}`);
            });
        }
    }
});

QUnit.start();
