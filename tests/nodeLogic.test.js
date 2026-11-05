/***
 *
 * UI-independent unit tests for the core data model: app/BTNode.js and app/BTAppNode.js.
 * Loaded by tests/nodeLogic.html, which maps BTAppNode's app imports onto tests/stubs/.
 *
 * Conventions:
 *  - Every test starts from an empty model (see the global beforeEach): AllNodes, Topics,
 *    BTNode.topIndex/undoStack, BTAppNode's static caches, stub call log/props/storage.
 *  - QUnit.todo marks a test describing behaviour we believe is a bug in current code. It
 *    "passes" while the bug exists and will start failing (prompting promotion to a real
 *    test) once fixed. Each one has a comment saying what actually happens today.
 *  - Methods that are really DOM rendering are not tested here; see the PR coverage list.
 *
 ***/
'use strict';

import { BTNode, AllNodes } from '../app/BTNode.js';
import { BTAppNode, BTLinkNode, Topics } from '../app/BTAppNode.js';
import { calls, callsTo, resetCalls } from './stubs/callLog.js';
import { setBackgroundResponse } from './stubs/extensionMessaging.js';
import { setProp, resetProps, setMetaProperties } from './stubs/configManager.js';
import { localStorageManager, seedDB } from './stubs/localFileManager.js';

/* global $, QUnit */

/***
 * Helpers
 ***/

function resetModel() {
    AllNodes.length = 0;                      // AllNodes is an exported var binding: empty it, can't reassign
    BTNode.topIndex = 1;
    BTNode.undoStack = [];
    BTNode.undoIndices = [];
    Topics.length = 0;
    BTAppNode.searchNodesToRedisplay.clear();
    BTAppNode.displayOrder = {};
    BTAppNode._aliasesLoaded = false;
    BTAppNode._aliasesLoadPromise = null;
    resetCalls();
    resetProps();
    setBackgroundResponse({ status: 'success' });
    localStorageManager.clear();
    window.testAlerts.length = 0;
    window.testConfirms.length = 0;
    window.testConfirmAnswer = true;
    window.Window.BrainTool = {};             // NB app code uses Window (the constructor) as a global bag
}

QUnit.hooks.beforeEach(resetModel);

function topic(title, parent = null, text = '') {
    return new BTAppNode(title, parent ? parent.id : null, text, parent ? parent.level + 1 : 1);
}
function link(url, label, parent, text = '') {
    return new BTAppNode(`[[${url}][${label}]]`, parent ? parent.id : null, text, parent ? parent.level + 1 : 1);
}
function ids(nodes) {
    return nodes.map(n => n.id);
}
function renderRows(nodes) {
    // Minimal stand-ins for the treetable rows, in display order. Enough for code that looks
    // rows up by data-tt-id (getDisplayNode, setDisplayOrder, generateTopics, generateOrgFile).
    $('#qunit-fixture').html('<table id="content"></table>');
    nodes.forEach(n => $('#content').append(
        `<tr data-tt-id='${n.id}'><td class='left'><span class='indenter'></span>` +
        `<span class='btTitle'><span class='btTitleText'></span></span></td>` +
        `<td class='right'><span class='btText'></span></td></tr>`));
}
function initTreeTable() {
    // A real (empty) treetable, for the findOrCreate* functions which call createDisplayNode
    $('#qunit-fixture').html('<table id="content"></table>');
    $('#content').treetable({ expandable: true, initialState: 'expanded' }, true);
}
function sessionCopy(node) {
    // Stand-in for a BTSessionNode mirroring an app node: same browser ids, flagged as session
    const s = new BTAppNode(node.title, null, '', node.level);
    s.isSessionNode = true;
    s.tabId = node.tabId;
    s.windowId = node.windowId;
    s._tabGroupId = node.tabGroupId;
    return s;
}


/*****************************************************************************************
 *
 * BTNode
 *
 *****************************************************************************************/

QUnit.module('BTNode: construction, ids and AllNodes', function () {

    QUnit.test('ids are sequential from topIndex and indexed in AllNodes', function (assert) {
        const a = new BTNode('A');
        const b = new BTNode('B');
        assert.strictEqual(a.id, 1, 'first id is 1 (0 is never used)');
        assert.strictEqual(b.id, 2);
        assert.strictEqual(AllNodes[1], a);
        assert.strictEqual(AllNodes[2], b);
        assert.strictEqual(AllNodes[0], undefined, 'AllNodes is sparse, slot 0 empty');
        assert.strictEqual(BTNode.topIndex, 3);
    });

    QUnit.test('ids are not reused after delete', function (assert) {
        const a = new BTNode('A');
        BTNode.deleteNode(a.id);
        const b = new BTNode('B');
        assert.strictEqual(b.id, 2);
        assert.notOk(1 in AllNodes, 'deleted slot stays a hole');
    });

    QUnit.test('defaults', function (assert) {
        const a = new BTNode('Plain');
        assert.strictEqual(a.parentId, null);
        assert.deepEqual(a.childIds, []);
        assert.strictEqual(a.URL, '');
        assert.strictEqual(a.title, 'Plain');
        assert.strictEqual(a.displayTopic, 'Plain');
        assert.strictEqual(a.topicPath, '');
    });

    QUnit.test('parent/child links are set up by the constructor', function (assert) {
        const p = new BTNode('P');
        const c1 = new BTNode('C1', p.id);
        const c2 = new BTNode('C2', p.id);
        const c0 = new BTNode('C0', p.id, true);          // firstChild
        assert.strictEqual(c1.parentId, p.id);
        assert.deepEqual(p.childIds, [c0.id, c1.id, c2.id], 'appended, firstChild goes to front');
    });

    QUnit.test('unknown parentId is kept but nothing is linked', function (assert) {
        const c = new BTNode('Orphan', 99);
        assert.strictEqual(c.parentId, 99);
        assert.strictEqual(AllNodes[99], undefined);
    });

    QUnit.test('subclass instance replaces the base entry in AllNodes', function (assert) {
        const n = new BTAppNode('T', null, '', 1);
        assert.ok(AllNodes[n.id] instanceof BTAppNode);
    });

    QUnit.test('org reserved words are renamed, with an alert', function (assert) {
        const n = new BTNode('TODO');
        assert.strictEqual(n.title, 'Todo');
        n.title = 'DONE';
        assert.strictEqual(n.title, 'Done');
        assert.strictEqual(window.testAlerts.length, 2);
        n.title = 'TODO list';
        assert.strictEqual(n.title, 'TODO list', 'only an exact match is reserved');
    });
});

QUnit.module('BTNode: title and URL parsing', function () {

    QUnit.test('URLFromTitle', function (assert) {
        const u = BTNode.URLFromTitle;
        assert.strictEqual(u('[[https://a.com/x][A]]'), 'https://a.com/x');
        assert.strictEqual(u('[[http://a.com][A]]'), 'http://a.com');
        assert.strictEqual(u('[[file:///tmp/x.org][F]]'), 'file:///tmp/x.org');
        assert.strictEqual(u('[[file:x.org][F]]'), 'file:x.org');
        assert.strictEqual(u('[[chrome://extensions][C]]'), 'chrome://extensions');
        assert.strictEqual(u('[[edge://settings][E]]'), 'edge://settings');
        assert.strictEqual(u('[[brave://settings][B]]'), 'brave://settings');
        assert.strictEqual(u('Pre [[https://a.com][A]] post'), 'https://a.com', 'link inside text');
        assert.strictEqual(u('[[https://1.com][1]] and [[https://2.com][2]]'), 'https://1.com', 'first link wins');
        assert.strictEqual(u('[[https://a.com][]]'), 'https://a.com', 'empty label');
        assert.strictEqual(u('[[id:1234][Internal]]'), '', 'org id: links are not URLs');
        assert.strictEqual(u('[[ftp://a.com][A]]'), '', 'unsupported scheme');
        assert.strictEqual(u('no link here'), '');
        assert.strictEqual(u('https://bare.com'), '', 'bare url is not a link');
    });

    QUnit.test('displayNameFromTitle', function (assert) {
        const d = BTNode.displayNameFromTitle;
        assert.strictEqual(d('[[https://a.com][Label]]'), 'Label');
        assert.strictEqual(d('[[https://a.com][]]'), 'https://a.com', 'falls back to url');
        assert.strictEqual(d('Pre [[https://a.com][A]] and [[x][B]] post'), 'Pre A and B post', 'all links');
        assert.strictEqual(d('a <b> & c'), 'a &lt;b&gt; &amp; c', 'html escaped');
        assert.strictEqual(d('Plain'), 'Plain');
    });

    QUnit.test('editableTopicFromTitle', function (assert) {
        const e = BTNode.editableTopicFromTitle;
        assert.strictEqual(e('[[https://a.com][Label]]'), 'Label');
        assert.strictEqual(e('Pre [[https://a.com][Label]] post'), 'Label');
        assert.strictEqual(e('Plain'), '', 'no link => empty');
        // Documenting current behaviour: greedy regex => last label when there are two links
        assert.strictEqual(e('[[https://1.com][One]] [[https://2.com][Two]]'), 'Two');
    });

    QUnit.test('title setter re-derives URL and displayTopic', function (assert) {
        const n = new BTNode('[[https://a.com][A]]');
        assert.strictEqual(n.URL, 'https://a.com');
        assert.strictEqual(n.displayTopic, 'A');
        n.title = 'Pre [[https://b.com][B]] post';
        assert.strictEqual(n.URL, 'https://b.com');
        assert.strictEqual(n.displayTopic, 'Pre B post');
    });

    QUnit.test('a link node cannot lose its URL', function (assert) {
        const n = new BTNode('[[https://a.com][A]]');
        assert.throws(() => { n.title = 'no link now'; }, /URL cannot be set to null/);
        assert.throws(() => { n.URL = ''; }, /URL cannot be set to null/);
        assert.strictEqual(n.URL, 'https://a.com', 'URL unchanged');
    });

    QUnit.test('a plain node can gain a URL', function (assert) {
        const n = new BTNode('Plain');
        n.URL = 'https://a.com';
        assert.strictEqual(n.URL, 'https://a.com');
        const m = new BTNode('Plain');
        m.title = '[[https://b.com][B]]';
        assert.strictEqual(m.URL, 'https://b.com');
    });

    QUnit.test('replaceURLandTitle', function (assert) {
        const n = new BTNode('[[https://a.com][A]]');
        assert.strictEqual(n.replaceURLandTitle('https://b.com', 'B'), '[[https://b.com][B]]');
        assert.strictEqual(n.URL, 'https://b.com');
        assert.strictEqual(n.displayTopic, 'B');

        const pre = new BTNode('Pre [[https://a.com][A]]');
        assert.strictEqual(pre.replaceURLandTitle('https://b.com', 'B'), 'Pre [[https://b.com][B]]', 'prefix kept');

        const plain = new BTNode('Plain');
        assert.strictEqual(plain.replaceURLandTitle('https://b.com', 'B'), 'Plain', 'no link => unchanged');
    });

    QUnit.test('replaceURLandTitle keeps text after the link', function (assert) {
        // Was bug 1: the trailing (.*?) was lazy and unanchored so it always matched '', and the
        // rebuilt title dropped everything after the link.
        const n = new BTNode('Pre [[https://a.com][A]] post');
        assert.strictEqual(n.replaceURLandTitle('https://b.com', 'B'), 'Pre [[https://b.com][B]] post');
    });

    QUnit.test('isTopicTree', function (assert) {
        assert.ok(new BTNode('[[https://braintool.org/topicTrees/x.org][T]]').isTopicTree());
        assert.ok(new BTNode('[[https://raw.githubusercontent.com/tconfrey/braintool/master/x.org][T]]').isTopicTree());
        assert.notOk(new BTNode('[[https://example.com/x.org][T]]').isTopicTree(), 'only braintool urls');
        assert.notOk(new BTNode('[[https://braintool.org/page.html][T]]').isTopicTree(), 'must be .org');
        assert.notOk(new BTNode('Plain').isTopicTree());
    });
});

QUnit.module('BTNode: static helpers', function () {

    QUnit.test('compareURLs', function (assert) {
        const c = BTNode.compareURLs;
        assert.ok(c('http://example.com', 'http://example.com'), 'identical');
        assert.ok(c('http://example.com', 'https://example.com'), 'http == https');
        assert.ok(c('http://example.com', 'http://example.com/'), 'trailing slash ignored');
        assert.ok(c('https://www.example.com/a', 'https://example.com/a'), 'www ignored');
        assert.ok(c('http://docs.google.com/u/1/d/abc', 'http://docs.google.com/d/abc'), 'gdocs /u/1/d');
        assert.notOk(c('http://example.com', 'http://example.org'), 'different');
        assert.ok(c('http://example.com/u/0/123#inbox', 'http://example.com/u/0/123#outbox'), 'final # anchor ignored');
        assert.notOk(c('http://example.com/u/0/123#inbox/app/456', 'http://example.com/u/0/123#outbox/app/456'), 'but not # mid path');
        assert.ok(c('http://mail.google.com/mail/u/0/#inbox', 'http://mail.google.com/mail/u/0/#inbox'), 'gmail identical');
        assert.notOk(c('http://mail.google.com/mail/u/0/#inbox', 'http://mail.google.com/mail/u/0/#sent'), 'gmail exact');
        assert.notOk(c('https://mail.google.com/mail/u/0/', 'http://mail.google.com/mail/u/0/'), 'gmail: not even http/https');
        assert.strictEqual(c('', 'http://a.com'), null, 'empty => null');
        assert.strictEqual(c('http://a.com', undefined), null);
    });

    QUnit.test('processTopicString', function (assert) {
        const p = BTNode.processTopicString;
        assert.deepEqual(p('  Topic  '), ['Topic', ''], 'trimmed');
        assert.deepEqual(p('Topic:TODO'), ['Topic', 'TODO']);
        assert.deepEqual(p('Parent:Topic:TODO'), ['Parent:Topic', 'TODO']);
        assert.deepEqual(p('Parent:Topic'), ['Parent:Topic', '']);
        assert.deepEqual(p('TODO'), ['Todo', ''], 'reserved word renamed');
        assert.deepEqual(p('DONE'), ['Done', '']);
    });

    QUnit.test('findFromTitle', function (assert) {
        const a = new BTNode('Alpha');
        const s = new BTNode('Alpha');
        s.isSessionNode = true;
        assert.strictEqual(BTNode.findFromTitle('Alpha'), a);
        assert.strictEqual(BTNode.findFromTitle('Alpha', { isSession: true }), s);
        assert.strictEqual(BTNode.findFromTitle('Nope'), undefined);
    });

    QUnit.test('findFromURL', function (assert) {
        const a = new BTNode('[[https://www.a.com/x/][A]]');
        const s = new BTNode('[[https://a.com/x][A]]');
        s.isSessionNode = true;
        assert.strictEqual(BTNode.findFromURL('http://a.com/x'), a, 'uses compareURLs');
        assert.strictEqual(BTNode.findFromURL('http://a.com/x', { isSession: true }), s);
        assert.strictEqual(BTNode.findFromURL('http://b.com'), undefined);
    });
});

QUnit.module('BTNode: children', function () {

    QUnit.test('addChild positions', function (assert) {
        const p = new BTNode('P');
        p.addChild(10, false);
        p.addChild(11, false);
        assert.deepEqual(p.childIds, [10, 11], 'index false => append');
        p.addChild(12, false, true);
        assert.deepEqual(p.childIds, [12, 10, 11], 'firstChild => front');
        p.addChild(13, 1);
        assert.deepEqual(p.childIds, [12, 13, 10, 11], 'explicit index');
        p.addChild('14', false);
        assert.strictEqual(p.childIds[4], 14, 'string ids parsed to numbers');
        // Documenting current behaviour: no index argument means index undefined => splice(undefined)
        // => inserted at the front (undoDelete relies on this, see the undo tests)
        p.addChild(15);
        assert.strictEqual(p.childIds[0], 15, 'addChild(id) with no index inserts at the front');
    });

    QUnit.test('removeChild', function (assert) {
        const p = new BTNode('P');
        const a = new BTNode('A', p.id);
        const b = new BTNode('B', p.id);
        p.removeChild(a.id);
        assert.deepEqual(p.childIds, [b.id]);
        p.removeChild(String(b.id));
        assert.deepEqual(p.childIds, [], 'string id ok');
        p.removeChild(999);
        assert.deepEqual(p.childIds, [], 'missing id is a no-op');
        assert.strictEqual(a.parentId, p.id, 'removeChild does not touch the child');
    });

    QUnit.test('childIds setter sanitises', function (assert) {
        const p = new BTNode('P');
        p.childIds = ['1', 2, 'x', '3'];
        assert.deepEqual(p.childIds, [1, 2, 3]);
        p.childIds = 'nope';
        assert.deepEqual(p.childIds, []);
    });

    QUnit.test('indexInParent', function (assert) {
        const p = new BTNode('P');
        const a = new BTNode('A', p.id);
        const b = new BTNode('B', p.id);
        assert.strictEqual(a.indexInParent(), 0);
        assert.strictEqual(b.indexInParent(), 1);
        assert.strictEqual(p.indexInParent(), -1, 'top level => -1');
    });

    QUnit.test('getDescendantIds is depth first, pre-order', function (assert) {
        const a = new BTNode('A');
        const b = new BTNode('B', a.id);
        const c = new BTNode('C', b.id);
        const d = new BTNode('D', a.id);
        assert.deepEqual(a.getDescendantIds(), [b.id, c.id, d.id]);
        assert.deepEqual(c.getDescendantIds(), []);
        a.addChild(999, false);
        assert.deepEqual(a.getDescendantIds(), [b.id, c.id, d.id], 'dangling child ids skipped');
    });

    QUnit.test('findTopicChild', function (assert) {
        const p = topic('P');
        const t = topic('Sub', p);
        link('https://a.com', 'Sub', p);           // a link whose label matches is not a topic
        assert.strictEqual(p.findTopicChild('Sub'), t);
        assert.strictEqual(p.findTopicChild('Nope'), null);
    });
});

QUnit.module('BTNode: topics, ancestry and topic paths', function () {

    QUnit.test('isTopic (base class, no level)', function (assert) {
        const t = new BTNode('Topic');
        const l = new BTNode('[[https://a.com][A]]', t.id);
        assert.ok(t.isTopic(), 'no URL => topic');
        assert.notOk(l.isTopic(), 'URL leaf => not a topic');
        new BTNode('[[https://b.com][B]]', l.id);
        assert.ok(l.isTopic(), 'URL node with link children => topic');
    });

    QUnit.test('_hasWebLinks', function (assert) {
        const t = new BTNode('Top');
        const s = new BTNode('Sub', t.id);
        const f = new BTNode('[[file:x.org][f]]', s.id);
        assert.ok(f._hasWebLinks(), 'file: link');
        assert.ok(s._hasWebLinks() && t._hasWebLinks(), 'bubbles up to ancestors');
        assert.notOk(new BTNode('Lonely')._hasWebLinks(), 'childless, no URL');
    });

    QUnit.test('_hasWebLinks is false for a subtree with no URLs', function (assert) {
        // Was bug 2: _hasWebLinks and isTopic passed the method itself (always truthy) to some()
        // instead of calling it, so any URL node with any child (eg a plain note) was a topic.
        const p = new BTNode('Parent');
        new BTNode('plain child', p.id);
        assert.notOk(p._hasWebLinks());
        const l = new BTNode('[[https://a.com][A]]');
        new BTNode('plain note', l.id);
        assert.notOk(l.isTopic(), 'link with only a non-link child is not a topic');
    });

    QUnit.test('topicName', function (assert) {
        const t = topic('Topic');
        const lt = link('https://a.com', 'Link Topic', t);
        const l = link('https://b.com', 'Leaf', lt);
        assert.strictEqual(t.topicName(), 'Topic');
        assert.strictEqual(lt.topicName(), 'Link Topic', 'URL topic => link label');
        assert.strictEqual(l.topicName(), 'Link Topic', 'non topic => parent topicName');
        const pri = topic('[#A] Urgent');
        assert.strictEqual(pri.topicName(), '[#A] Urgent', 'priority cookie is just title text');
    });

    QUnit.test('fullTopicPath', function (assert) {
        const a = topic('A');
        const b = topic('B', a);
        const c = topic('C', b);
        const l = link('https://a.com', 'L', b);
        assert.strictEqual(a.fullTopicPath(), 'A');
        assert.strictEqual(c.fullTopicPath(), 'A:B:C');
        assert.strictEqual(l.fullTopicPath(), 'A:B:', 'documenting: link contributes an empty segment');
    });

    QUnit.test('generateUniqueTopicPaths: unique names', function (assert) {
        const a = topic('A');
        const b = topic('B', a);
        const l = link('https://a.com', 'L', b);
        BTNode.generateUniqueTopicPaths();
        assert.strictEqual(a.topicPath, 'A');
        assert.strictEqual(b.topicPath, 'B', 'unique names are not qualified');
        assert.strictEqual(l.topicPath, 'B', 'links get their parent topic path');
    });

    QUnit.test('generateUniqueTopicPaths: duplicate names are qualified by parent', function (assert) {
        const home = topic('Home');
        const office = topic('Office');
        const w1 = topic('Work', home);
        const w2 = topic('Work', office);
        const l = link('https://a.com', 'L', w2);
        BTNode.generateUniqueTopicPaths();
        assert.strictEqual(w1.topicPath, 'Home:Work');
        assert.strictEqual(w2.topicPath, 'Office:Work');
        assert.strictEqual(l.topicPath, 'Office:Work');
        assert.strictEqual(home.topicPath, 'Home');
    });

    QUnit.test('generateUniqueTopicPaths: qualifies as deep as needed', function (assert) {
        const a = topic('A');
        const b = topic('B');
        const x1 = topic('X', a);
        const x2 = topic('X', b);
        const y1 = topic('Y', x1);
        const y2 = topic('Y', x2);
        BTNode.generateUniqueTopicPaths();
        assert.strictEqual(x1.topicPath, 'A:X');
        assert.strictEqual(x2.topicPath, 'B:X');
        assert.strictEqual(y1.topicPath, 'A:X:Y');
        assert.strictEqual(y2.topicPath, 'B:X:Y');
    });

    QUnit.test('generateUniqueTopicPaths: session nodes are ignored', function (assert) {
        const t = topic('Same');
        const s = topic('Same');
        s.isSessionNode = true;
        BTNode.generateUniqueTopicPaths();
        assert.strictEqual(t.topicPath, 'Same', 'no collision with a session node');
        assert.strictEqual(s.topicPath, '');
    });

    QUnit.test('generateUniqueTopicPaths: duplicate top-level names both get a path', function (assert) {
        // Was bug 3: two top-level topics with the same name can't be qualified by a parent, and
        // only the first id in the bucket got a path; the second kept '' and showed up in Topics.
        const a = topic('Dup');
        const b = topic('Dup');
        BTNode.generateUniqueTopicPaths();
        assert.ok(a.topicPath, 'first has a path');
        assert.ok(b.topicPath, 'second has a path');
        assert.notStrictEqual(a.topicPath, b.topicPath, 'and they differ');
    });

    QUnit.test('generateUniqueTopicPaths: parentless non-topic does not throw', function (assert) {
        // Was bug 4: topicName() was called on every node before checking isTopic; for a
        // non-topic with no parent it dereferenced AllNodes[null] and threw, so the fallback
        // for exactly this case was unreachable.
        // (BTAppNode level-1 nodes are always topics, so this needs a level>1 parentless node,
        // eg a link whose parent was deleted out from under it.)
        new BTAppNode('[[https://a.com][Stray]]', null, '', 2);
        let threw = false;
        try { BTNode.generateUniqueTopicPaths(); } catch { threw = true; }
        assert.notOk(threw);
        assert.strictEqual(AllNodes.find(n => n)?.topicPath, 'Stray', 'falls back to the link label');
    });
});

QUnit.module('BTNode: moves', function () {

    QUnit.test('reparentNode to a new parent at an explicit index', function (assert) {
        const p1 = new BTNode('P1');
        const p2 = new BTNode('P2');
        const a = new BTNode('A', p1.id);
        const x = new BTNode('X', p2.id);
        const y = new BTNode('Y', p2.id);
        a.reparentNode(p2.id, 1);
        assert.strictEqual(a.parentId, p2.id);
        assert.deepEqual(p1.childIds, []);
        assert.deepEqual(p2.childIds, [x.id, a.id, y.id]);
        a.reparentNode(p1.id, 0);
        assert.deepEqual(p1.childIds, [a.id]);
        assert.deepEqual(p2.childIds, [x.id, y.id]);
    });

    QUnit.test('reparentNode within the same parent reorders', function (assert) {
        const p = new BTNode('P');
        const a = new BTNode('A', p.id);
        const b = new BTNode('B', p.id);
        const c = new BTNode('C', p.id);
        a.reparentNode(p.id, 2);
        assert.deepEqual(p.childIds, [b.id, c.id, a.id], 'move down (index is post-removal)');
        a.reparentNode(p.id, 0);
        assert.deepEqual(p.childIds, [a.id, b.id, c.id], 'move up');
    });

    QUnit.test('reparentNode to and from top level', function (assert) {
        const p = new BTNode('P');
        const a = new BTNode('A', p.id);
        a.reparentNode(null);
        assert.strictEqual(a.parentId, null);
        assert.deepEqual(p.childIds, []);
        a.reparentNode(p.id, 0);
        assert.strictEqual(a.parentId, p.id);
        assert.deepEqual(p.childIds, [a.id]);
        const t = new BTNode('T');
        t.reparentNode(null);
        assert.strictEqual(t.parentId, null, 'top to top is a no-op');
    });

    QUnit.test('reparentNode refuses self as parent', function (assert) {
        const a = new BTNode('A');
        assert.throws(() => a.reparentNode(a.id), /setting self to parent/);
    });

    QUnit.test('reparentNode with the default index appends to the new parent', function (assert) {
        // Was bug 5: the default index -1 became splice(-1, 0, id), inserting *before the last*
        // child, so model order drifted from the displayed order.
        const p = new BTNode('P');
        const x = new BTNode('X', p.id);
        const y = new BTNode('Y', p.id);
        const a = new BTNode('A');
        a.reparentNode(p.id);
        assert.deepEqual(p.childIds, [x.id, y.id, a.id]);
        x.reparentNode(p.id);
        assert.deepEqual(p.childIds, [y.id, a.id, x.id], 'same parent, default index => last');
    });
});

QUnit.module('BTNode: delete and undo', function () {

    QUnit.test('deleteNode removes the subtree and unlinks from parent', function (assert) {
        const p = new BTNode('P');
        const b = new BTNode('B', p.id);
        const c1 = new BTNode('C1', b.id);
        const c2 = new BTNode('C2', b.id);
        const keep = new BTNode('Keep', p.id);
        BTNode.deleteNode(b.id);
        assert.notOk(b.id in AllNodes);
        assert.notOk(c1.id in AllNodes);
        assert.notOk(c2.id in AllNodes);
        assert.deepEqual(p.childIds, [keep.id]);
        assert.deepEqual(ids(BTNode.undoStack), [c1.id, c2.id, b.id], 'post-order: children then node');
    });

    QUnit.test('deleteNode keeps only one level of undo', function (assert) {
        const a = new BTNode('A');
        const b = new BTNode('B');
        BTNode.deleteNode(a.id);
        BTNode.deleteNode(b.id);
        assert.deepEqual(ids(BTNode.undoStack), [b.id]);
        BTNode.deleteNode(12345);
        assert.deepEqual(BTNode.undoStack, [], 'deleting a missing id still clears undo');
    });

    QUnit.test('undoDelete restores nodes and links and returns the top node', function (assert) {
        const p = new BTNode('P');
        const b = new BTNode('B', p.id);
        const c1 = new BTNode('C1', b.id);
        const c2 = new BTNode('C2', b.id);
        BTNode.deleteNode(b.id);
        const top = BTNode.undoDelete();
        assert.strictEqual(top, b);
        assert.strictEqual(AllNodes[b.id], b);
        assert.strictEqual(AllNodes[c1.id], c1);
        assert.deepEqual(p.childIds, [b.id]);
        assert.deepEqual(b.childIds, [c1.id, c2.id], 'child order preserved');
        assert.deepEqual(BTNode.undoStack, [], 'stack drained');
        assert.strictEqual(BTNode.undoDelete(), undefined, 'nothing more to undo');
    });

    QUnit.test('undoDelete of a top-level node', function (assert) {
        const a = new BTNode('A');
        BTNode.deleteNode(a.id);
        assert.strictEqual(BTNode.undoDelete(), a);
        assert.strictEqual(AllNodes[a.id], a);
    });

    QUnit.test('undoDelete puts the node back at its original position', function (assert) {
        // Was bug 6: undoDelete called addChild(id) with no index, which inserts at the front,
        // so a restored node always became its parent's first child.
        const p = new BTNode('P');
        const x = new BTNode('X', p.id);
        const b = new BTNode('B', p.id);
        const y = new BTNode('Y', p.id);
        BTNode.deleteNode(b.id);
        BTNode.undoDelete();
        assert.deepEqual(p.childIds, [x.id, b.id, y.id]);
        const c1 = new BTNode('C1', b.id);
        const c2 = new BTNode('C2', b.id);
        const c3 = new BTNode('C3', b.id);
        BTNode.deleteNode(b.id);
        BTNode.undoDelete();
        assert.deepEqual(p.childIds, [x.id, b.id, y.id], 'again, with a subtree');
        assert.deepEqual(b.childIds, [c1.id, c2.id, c3.id], 'subtree order preserved');
    });
});


/*****************************************************************************************
 *
 * BTAppNode
 *
 *****************************************************************************************/

QUnit.module('BTAppNode: basics', function () {

    QUnit.test('constructor defaults', function (assert) {
        const n = new BTAppNode('[[https://a.com][A]]', null, 'notes', 1);
        assert.strictEqual(n.text, 'notes');
        assert.strictEqual(n.level, 1);
        assert.strictEqual(n.folded, false);
        assert.strictEqual(n.keyword, null);
        assert.strictEqual(n.tabId, 0);
        assert.strictEqual(n.tabGroupId, 0);
        assert.strictEqual(n.windowId, 0);
        assert.strictEqual(n.bookmarkId, 0);
        assert.strictEqual(n.opening, false);
        assert.deepEqual(n.tags, []);
        assert.deepEqual(n.drawers, {});
        assert.strictEqual(n.planning, '');
        assert.ok(n.aliases instanceof Set && n.aliases.size === 0);
        assert.strictEqual(n.URL, 'https://a.com', 'base class parsing still applies');
    });

    QUnit.test('level-1 nodes are always topics', function (assert) {
        const l = link('https://a.com', 'A', null);
        assert.strictEqual(l.level, 1);
        assert.ok(l.isTopic(), 'top level link counts as a topic');
        const t = topic('T');
        const l2 = link('https://b.com', 'B', t);
        assert.notOk(l2.isTopic());
    });

    QUnit.test('simple accessors', function (assert) {
        const n = topic('T');
        n.text = 'x'; n.level = 3; n.folded = true; n.tabId = 7; n.windowId = 8;
        n.bookmarkId = 9; n.tabIndex = 4; n.opening = true; n.tabGroupId = 6;
        assert.deepEqual([n.text, n.level, n.folded, n.tabId, n.windowId, n.bookmarkId, n.tabIndex, n.opening, n.tabGroupId],
                         ['x', 3, true, 7, 8, 9, 4, true, 6]);
        n.tabGroupId = 0;
        assert.strictEqual(n.tabGroupId, 0, 'clearing tabGroupId ok without a display row');
    });

    QUnit.test('url()', function (assert) {
        assert.strictEqual(link('https://a.com', 'A', null).url(), 'https://a.com');
        assert.strictEqual(new BTAppNode('[[id:123][Internal]]', null, '', 1).url(), 'id:123', 'any [[x][y]] link');
        assert.strictEqual(topic('T').url(), '');
    });

    QUnit.test('allowedRowActions', function (assert) {
        const actions = topic('T').allowedRowActions();
        ['open', 'openInNewWindow', 'close', 'delete', 'addChild', 'promote', 'edit', 'todo', 'drag']
            .forEach(a => assert.strictEqual(actions[a], true, a));
    });

    QUnit.test('canMoveTo', function (assert) {
        const t = topic('T');
        const l = link('https://a.com', 'A', t);
        assert.ok(t.canMoveTo(null), 'topic can go top level');
        assert.notOk(l.canMoveTo(null), 'leaf cannot go top level');
        assert.ok(l.canMoveTo(topic('Other')));
    });

    QUnit.test('canAcceptDrop', function (assert) {
        const t = topic('T');
        const leaf = link('https://a.com', 'A', t);
        const other = topic('Other');
        const trash = topic('🗑️ TRASH');
        const fakeSession = (ok) => ({ isSessionNode: true, isTopic: () => false, canBeDroppedInTopicTree: () => ok });

        assert.notOk(t.canAcceptDrop(null), 'no node');
        assert.ok(t.canAcceptDrop(leaf), 'expanded topic accepts a leaf');
        assert.ok(trash.canAcceptDrop(leaf), 'trash accepts app nodes');
        assert.notOk(trash.canAcceptDrop(fakeSession(true)), 'trash refuses session nodes');
        leaf.trashed = true;
        assert.ok(leaf.canAcceptDrop(other), 'trashed node behaves like trash');
        leaf.trashed = false;

        other.folded = true;
        assert.notOk(other.canAcceptDrop(leaf), 'folded top-level: leaf would land at top level');
        assert.ok(other.canAcceptDrop(t), 'folded top-level: topic may land at top level');

        assert.strictEqual(t.canAcceptDrop(fakeSession(true)), true, 'session node: delegated');
        assert.strictEqual(t.canAcceptDrop(fakeSession(false)), false, 'session node: delegated');
    });
});

QUnit.module('BTAppNode: keyword (TODO/DONE) state', function () {

    QUnit.test('iterateKeyword cycles null -> TODO -> DONE -> null', function (assert) {
        const n = topic('T');
        n.iterateKeyword();
        assert.strictEqual(n.keyword, 'TODO');
        n.iterateKeyword();
        assert.strictEqual(n.keyword, 'DONE');
        n.iterateKeyword();
        assert.strictEqual(n.keyword, null);
    });

    QUnit.test('other org keywords are left alone', function (assert) {
        const n = topic('T');
        n.keyword = 'WAITING';
        n.iterateKeyword();
        assert.strictEqual(n.keyword, 'WAITING');
    });

    QUnit.test('keyword shows in orgText', function (assert) {
        const n = topic('T');
        n.keyword = 'TODO';
        assert.strictEqual(n.orgText(), '* TODO T\n');
        n.iterateKeyword();
        assert.strictEqual(n.orgText(), '* DONE T\n');
        n.iterateKeyword();
        assert.strictEqual(n.orgText(), '* T\n');
    });

    QUnit.test('priority is not node state: it lives in the title text', function (assert) {
        const n = topic('[#A] Urgent');
        assert.strictEqual(n.orgText(), '* [#A] Urgent\n');
        n.keyword = 'TODO';
        assert.strictEqual(n.orgText(), '* TODO [#A] Urgent\n');
    });
});

QUnit.module('BTAppNode: open/closed bookkeeping (fake tab ids)', function () {

    function tree() {
        const t = topic('T');
        const a = link('https://a.com', 'A', t);
        const b = link('https://b.com', 'B', t);
        const s = topic('S', t);
        const c = link('https://c.com', 'C', s);
        return { t, a, b, s, c };
    }

    QUnit.test('nothing open', function (assert) {
        const { t, a, s } = tree();
        assert.strictEqual(t.hasOpenChildren(), 0);
        assert.notOk(t.hasOpenDescendants());
        assert.ok(t.hasUnopenDescendants());
        assert.ok(a.needsTab());
        assert.notOk(s.needsTab(), 'no URL => no tab');
        assert.strictEqual(t.countOpenableTabs(), 3);
        assert.strictEqual(t.countClosableTabs(), 0);
    });

    QUnit.test('some open', function (assert) {
        const { t, a, b, s, c } = tree();
        a.tabId = 101; c.tabId = 103;
        assert.strictEqual(t.hasOpenChildren(), 1, 'counts direct children only');
        assert.ok(t.hasOpenDescendants(), 'deep');
        assert.ok(s.hasOpenDescendants());
        assert.ok(t.hasUnopenDescendants(), 'b still closed');
        assert.notOk(a.needsTab());
        assert.strictEqual(t.countOpenableTabs(), 1);
        assert.strictEqual(t.countClosableTabs(), 2);
        assert.deepEqual(t.listOpenableTabs(), [{ nodeId: b.id, url: 'https://b.com' }]);
        assert.deepEqual(t.listOpenTabs(), [{ nodeId: a.id, tabId: 101 }], 'listOpenTabs: self + direct children only');
    });

    QUnit.test('all open', function (assert) {
        const { t, a, b, c } = tree();
        a.tabId = 1; b.tabId = 2; c.tabId = 3;
        assert.notOk(t.hasUnopenDescendants());
        assert.strictEqual(t.countOpenableTabs(), 0);
        assert.deepEqual(t.listOpenableTabs(), []);
    });

    QUnit.test('URL topic counts itself', function (assert) {
        const lt = link('https://top.com', 'Top', null);
        const c = link('https://c.com', 'C', lt);
        assert.deepEqual(lt.listOpenableTabs(), [{ nodeId: lt.id, url: 'https://top.com' }, { nodeId: c.id, url: 'https://c.com' }]);
        lt.tabId = 5;
        assert.deepEqual(lt.listOpenTabs(), [{ nodeId: lt.id, tabId: 5 }]);
    });

    QUnit.test('countOpenableWindows: one per topic with link children', function (assert) {
        const { t } = tree();
        topic('Empty', t);
        assert.strictEqual(t.countOpenableWindows(), 2, 'T and S');
    });

    QUnit.test('openWindowIds / findAnOpenNode', function (assert) {
        const { t, a, b } = tree();
        assert.deepEqual(t.openWindowIds(), []);
        assert.strictEqual(t.findAnOpenNode(), undefined);
        b.windowId = 77;
        assert.deepEqual(t.openWindowIds(), [77]);
        assert.strictEqual(t.findAnOpenNode(), b.id);
        a.windowId = 76;
        assert.deepEqual(t.openWindowIds(), [76, 77]);
    });

    QUnit.test('listOpenableTabGroups', function (assert) {
        const { t, a, b, s, c } = tree();
        a.tabId = 101;
        t.windowId = 9; t.tabGroupId = 33;
        assert.deepEqual(t.listOpenableTabGroups(), [
            { tabGroupId: 33, windowId: 9, groupName: 'T', tabGroupTabs: [{ nodeId: b.id, url: 'https://b.com' }] },
            { tabGroupId: 0, windowId: 0, groupName: 'S', tabGroupTabs: [{ nodeId: c.id, url: 'https://c.com' }] },
        ]);
        assert.deepEqual(a.listOpenableTabGroups(), [], 'links are not groups');
        c.tabId = 103;
        assert.deepEqual(s.listOpenableTabGroups(), [], 'nothing to open => no entry');
    });

    QUnit.test('tab ordering: tabIndexInParent / leftmostOpenTabIndex / expectedTabIndex', function (assert) {
        const p = topic('P');
        p.windowId = 1;
        const a = link('https://a.com', 'A', p);
        const b = link('https://b.com', 'B', p);
        const c = link('https://c.com', 'C', p);
        const d = link('https://d.com', 'D', p);
        Object.assign(a, { tabId: 10, windowId: 1, tabIndex: 4 });
        Object.assign(c, { tabId: 11, windowId: 1, tabIndex: 5 });
        Object.assign(d, { tabId: 12, windowId: 2, tabIndex: 0 });      // other window
        assert.strictEqual(a.tabIndexInParent(), 0);
        assert.strictEqual(c.tabIndexInParent(), 1, 'counts open siblings before it in the same window');
        assert.strictEqual(b.tabIndexInParent(), 0, 'only counts siblings in its own window (b has none)');
        assert.strictEqual(p.leftmostOpenTabIndex(), 4, 'ignores other windows');
        assert.strictEqual(c.expectedTabIndex(), 5);
        assert.strictEqual(p.tabIndexInParent(), 0, 'top level => 0');
        assert.strictEqual(p.expectedTabIndex(), 0);
        p.tabId = 99;
        assert.strictEqual(a.tabIndexInParent(), 1, 'a parent with its own tab takes index 0');
        assert.strictEqual(topic('Empty').leftmostOpenTabIndex(), 0, 'no open children => 0');
    });

    QUnit.test('finders: tab, bookmark, window, group', function (assert) {
        const { t, a } = tree();
        a.tabId = 55; a.bookmarkId = 'bm1';
        t.windowId = 3; t._tabGroupId = 44;
        const sa = sessionCopy(a);
        const st = sessionCopy(t);
        st.sessionType = 'WINDOW';
        assert.strictEqual(BTAppNode.findFromTab(55), a);
        assert.strictEqual(BTAppNode.findFromTab(55, { isSession: true }), sa);
        assert.strictEqual(BTAppNode.findFromTab(56), undefined);
        assert.strictEqual(BTAppNode.findFromBookmark('bm1'), a);
        assert.strictEqual(BTAppNode.findFromWindow(3), t, 'app: topic with that window');
        assert.strictEqual(BTAppNode.findFromWindow(3, { isSession: true }), st, 'session: WINDOW node');
        assert.strictEqual(BTAppNode.findFromGroup(44), t);
        assert.strictEqual(BTAppNode.findFromGroup(44, { isSession: true }), st);
        assert.strictEqual(BTAppNode.findFromGroup(45), undefined);
    });

    QUnit.test('sisterNodes', function (assert) {
        const { t, a, b } = tree();
        a.tabId = 55;
        t._tabGroupId = 44;
        const sa = sessionCopy(a);
        const st = sessionCopy(t);
        assert.deepEqual(a.sisterNodes(), [sa], 'tab: same tabId');
        assert.deepEqual(sa.sisterNodes(), [a]);
        assert.deepEqual(b.sisterNodes(), [], 'no tab => none');
        assert.deepEqual(t.sisterNodes(), [st], 'topic: same tabGroupId, other side');
        assert.deepEqual(st.sisterNodes(), [t]);
        assert.deepEqual(topic('X').sisterNodes(), [], 'no group => none');
    });

    QUnit.test('findFromURLTGWin', function (assert) {
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', 1, 1), null, 'none');
        const t1 = topic('T1');
        const t2 = topic('T2');
        const t3 = topic('T3');
        const a1 = link('https://a.com', 'A', t1);
        assert.strictEqual(BTAppNode.findFromURLTGWin('http://a.com/', 0, 0), a1, 'unique (compareURLs)');
        const a2 = link('https://a.com', 'A', t2);
        const a3 = link('https://a.com', 'A', t3);
        t1._tabGroupId = 10; t2._tabGroupId = 20; t3._tabGroupId = 30;
        t1.windowId = 1; t2.windowId = 2; t3.windowId = 3;
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', -1, -1), a1, 'dups, nothing matches => first');
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', 20, -1), a2, 'tab group match');
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', -1, 3), a3, 'window match');
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', 20, 3), a2, 'tab group beats window');
        link('https://other.com', 'O', t3).tabId = 9;              // t3 now has an open tab
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', 20, -1), a3, 'open topic preferred over TG match elsewhere');
        assert.strictEqual(BTAppNode.findFromURLTGWin('https://a.com', 0, 0, { isSession: true }), null, 'session side empty');
    });
});

QUnit.module('BTAppNode: special topics', function () {

    QUnit.test('isTrash / isBookmarksBar / isOnBookmarksBar', function (assert) {
        const trash = topic('🗑️ TRASH');
        const bb = topic('🔖 BOOKMARKS BAR');
        const sub = topic('Sub', bb);
        const l = link('https://a.com', 'A', sub);
        const other = topic('Other');
        assert.ok(trash.isTrash());
        assert.notOk(other.isTrash());
        assert.ok(bb.isBookmarksBar());
        assert.notOk(sub.isBookmarksBar());
        assert.ok(l.isOnBookmarksBar(), 'deep descendant');
        assert.notOk(other.isOnBookmarksBar());
    });

    QUnit.test('trash / untrash flag the subtree', function (assert) {
        const t = topic('T');
        const s = topic('S', t);
        const l = link('https://a.com', 'A', s);
        t.trash();
        assert.ok(t.trashed && s.trashed && l.trashed);
        s.untrash();
        assert.ok(t.trashed, 'ancestor untouched');
        assert.notOk(s.trashed || l.trashed);
        const trash = topic('🗑️ TRASH');
        trash.trash();
        assert.notOk(trash.trashed, 'the trash node itself is never trashed');
    });

    QUnit.test('class lists reflect special/trashed/topic state', function (assert) {
        const trash = topic('🗑️ TRASH');
        const t = topic('T');
        const l = link('https://a.com', 'A', t);
        assert.deepEqual(trash.titleSpanClassList(), ['btTitleText', 'btTitle', 'specialTopic']);
        assert.deepEqual(l.titleSpanClassList(), ['btTitle']);
        l.trashed = true;
        assert.deepEqual(l.titleSpanClassList(), ['btTitle', 'trashed']);
        assert.deepEqual(trash.rowClassList(), ['topic', 'emptyTopic']);
        assert.deepEqual(t.rowClassList(), ['topic']);
        assert.deepEqual(l.rowClassList(), []);
    });

    QUnit.test('trash and bookmarks bar contents are not written to org', function (assert) {
        const trash = topic('🗑️ TRASH', null, 'Deleted items.');
        link('https://a.com', 'A', trash);
        const bb = topic('🔖 BOOKMARKS BAR');
        link('https://b.com', 'B', bb);
        assert.strictEqual(trash.orgTextwChildren(), '* 🗑️ TRASH\nDeleted items.\n');
        assert.strictEqual(bb.orgTextwChildren(), '* 🔖 BOOKMARKS BAR\n');
    });

    QUnit.test('findOrCreateTrashNode / findOrCreateBookmarksBarNode', function (assert) {
        initTreeTable();
        const trash = BTAppNode.findOrCreateTrashNode();
        assert.ok(trash.isTrash());
        assert.strictEqual(trash.level, 1);
        assert.strictEqual(trash.parentId, null);
        assert.strictEqual(BTAppNode.findOrCreateTrashNode(), trash, 'found second time');
        const bb = BTAppNode.findOrCreateBookmarksBarNode();
        assert.ok(bb.isBookmarksBar());
        assert.strictEqual(BTAppNode.findOrCreateBookmarksBarNode(), bb);
        assert.strictEqual(AllNodes.filter(Boolean).length, 2);
    });
});

QUnit.module('BTAppNode: topics and Topics', function () {

    QUnit.test('generateTopics: display order, levels, unique paths, no trash', function (assert) {
        const b = topic('B');
        const a = topic('A');
        const w1 = topic('Work', a);
        const w2 = topic('Work', b);
        const l = link('https://x.com', 'X', w1);
        const trash = topic('🗑️ TRASH');
        topic('Junk', trash);
        const sess = topic('Session');
        sess.isSessionNode = true;
        renderRows([sess, a, w1, l, b, w2, trash]);           // rows in display order, A before B

        BTAppNode.generateTopics();
        assert.deepEqual(Topics.map(t => ({ ...t })), [
            { name: 'A', level: 1 },
            { name: 'A:Work', level: 2 },
            { name: 'B', level: 1 },
            { name: 'B:Work', level: 2 },
        ]);
        const msgs = callsTo('sendMessage');
        assert.strictEqual(msgs.length, 1);
        assert.strictEqual(msgs[0].args[0].function, 'localStore');
        assert.strictEqual(msgs[0].args[0].data.topics, Topics, 'extension told about Topics');
    });

    QUnit.test('generateTopics resets the list', function (assert) {
        const a = topic('A');
        renderRows([a]);
        BTAppNode.generateTopics();
        BTAppNode.generateTopics();
        assert.strictEqual(Topics.length, 1);
    });

    QUnit.test('findOrCreateFromTopicDN: creates a new path', function (assert) {
        initTreeTable();
        const leaf = BTAppNode.findOrCreateFromTopicDN('A:B:C');
        assert.strictEqual(leaf.topicName(), 'C');
        assert.strictEqual(leaf.level, 3);
        const b = AllNodes[leaf.parentId];
        const a = AllNodes[b.parentId];
        assert.strictEqual(b.title, 'B');
        assert.strictEqual(a.title, 'A');
        assert.strictEqual(a.parentId, null);
        assert.strictEqual(leaf.newTopNodeId, a.id, 'reports the highest new node');
        assert.strictEqual(leaf.fullTopicPath(), 'A:B:C');
    });

    QUnit.test('findOrCreateFromTopicDN: finds existing', function (assert) {
        initTreeTable();
        const a = topic('A');
        const b = topic('B', a);
        a.createDisplayNode(); b.createDisplayNode();
        assert.strictEqual(BTAppNode.findOrCreateFromTopicDN('A'), a);
        assert.strictEqual(a.newTopNodeId, undefined, 'nothing new');
        assert.strictEqual(BTAppNode.findOrCreateFromTopicDN('A:B'), b);
        const c = BTAppNode.findOrCreateFromTopicDN('A:B:C');
        assert.strictEqual(c.parentId, b.id, 'only the missing leaf is created');
        assert.strictEqual(c.newTopNodeId, c.id);
        assert.strictEqual(AllNodes.filter(Boolean).length, 3);
    });

    QUnit.test('findOrCreateFromTopicDN: single name creates a top level topic', function (assert) {
        initTreeTable();
        const n = BTAppNode.findOrCreateFromTopicDN('Fresh');
        assert.strictEqual(n.level, 1);
        assert.strictEqual(n.parentId, null);
        assert.strictEqual(n.newTopNodeId, n.id);
    });

    QUnit.test('findOrCreateFromTopicDN: resolves a numbered duplicate topicPath', function (assert) {
        initTreeTable();
        const a = topic('Dup');
        const b = topic('Dup');
        a.createDisplayNode(); b.createDisplayNode();
        BTNode.generateUniqueTopicPaths();
        assert.strictEqual(BTAppNode.findOrCreateFromTopicDN(a.topicPath), a);
        assert.strictEqual(BTAppNode.findOrCreateFromTopicDN(b.topicPath), b, 'second Dup, not a new topic');
        assert.strictEqual(AllNodes.filter(Boolean).length, 2);
    });

    QUnit.test('findOrCreateFromTopicDN: first segment matches a topic anywhere (topicPaths are not full paths)', function (assert) {
        initTreeTable();
        const home = topic('Home');
        const work = topic('Work', home);
        home.createDisplayNode(); work.createDisplayNode();
        const p = BTAppNode.findOrCreateFromTopicDN('Work:Project');
        assert.strictEqual(p.parentId, work.id, 'nested Work is found, no new top-level Work');
    });
});

QUnit.module('BTAppNode: org text for a node', function () {

    QUnit.test('orgText basics', function (assert) {
        const t = topic('Topic', null, 'Some notes');
        assert.strictEqual(t.orgText(), '* Topic\nSome notes\n');
        const l = link('https://a.com', 'A', t);
        assert.strictEqual(l.orgText(), '** [[https://a.com][A]]\n', 'no text => no text line');
    });

    QUnit.test('orgTags pads tags to column 77', function (assert) {
        const t = topic('Topic');
        t.tags = ['a', 'b'];
        const line = t.orgText().split('\n')[0];
        assert.ok(line.startsWith('* Topic '));
        assert.ok(line.endsWith(' :a:b:'));
        assert.strictEqual(line.length, 77);
        t.title = 'x'.repeat(100);
        assert.ok(t.orgText().startsWith('* ' + 'x'.repeat(100) + ' :a:b:'), 'at least one space when too long');
        t.tags = [];
        assert.strictEqual(t.orgTags('* x'), '');
    });

    QUnit.test('planning and drawers come after the headline', function (assert) {
        const t = topic('T', null, 'body');
        t.planning = 'SCHEDULED: <2025-01-01 Wed>\n';
        t.drawers = { PROPERTIES: ':ID: abc-123' };
        // ' +' rather than ' ': see the property-spacing todo below
        assert.ok(/^\* T\nSCHEDULED: <2025-01-01 Wed>\n  :PROPERTIES:\n  :ID: +abc-123\n  :END:\nbody\n$/.test(t.orgText()),
                  JSON.stringify(t.orgText()));
    });

    QUnit.test('orgDrawers: VISIBILITY tracks folded state', function (assert) {
        const t = topic('T');
        topic('child', t);
        t.drawers = { PROPERTIES: ':VISIBILITY: folded\n:ID: abc' };
        t.folded = false;
        assert.ok(/^  :PROPERTIES:\n  :ID: +abc\n  :END:\n$/.test(t.orgDrawers()), 'unfolded drops VISIBILITY');
        t.folded = true;
        assert.ok(/^  :PROPERTIES:\n  :VISIBILITY: folded\n  :ID: +abc\n  :END:\n$/.test(t.orgDrawers()), 'folded keeps it');
        t.drawers = { PROPERTIES: ':VISIBILITY: folded' };
        t.folded = false;
        assert.strictEqual(t.orgDrawers(), '', 'empty PROPERTIES drawer omitted');
    });

    QUnit.test('orgDrawers does not add a space before property values on each save', function (assert) {
        // Was bug 9 (each save added a space before every value); fixed in PR #54.
        const t = topic('T');
        t.drawers = { PROPERTIES: ':ID: abc' };
        assert.strictEqual(t.orgDrawers(), '  :PROPERTIES:\n  :ID: abc\n  :END:\n');
    });

    QUnit.test('orgDrawers: folded with no drawers adds one', function (assert) {
        const t = topic('T');
        t.folded = true;
        assert.strictEqual(t.orgDrawers(), '  :PROPERTIES:\n  :VISIBILITY: folded\n  :END:\n', 'level 1, even childless');
        const p = topic('P');
        const s = topic('S', p);
        s.folded = true;
        assert.strictEqual(s.orgDrawers(), '', 'childless non-top node: fold state not worth saving');
        topic('c', s);
        assert.ok(s.orgDrawers().includes(':VISIBILITY: folded'));
    });

    QUnit.test('orgDrawers: folded node with an existing PROPERTIES drawer keeps its folded state', function (assert) {
        // Was bug 10: VISIBILITY was only written if the drawer already had one, or if there was
        // no PROPERTIES drawer at all, so folding a node whose drawer had eg only :ID: was lost.
        const t = topic('T');
        topic('child', t);
        t.drawers = { PROPERTIES: ':ID: abc' };
        t.folded = true;
        assert.ok(t.orgDrawers().includes(':VISIBILITY: folded'));
    });

    QUnit.test('orgDrawers: non-property drawer content is kept', function (assert) {
        // Was bug 11: only /:prop: value/ lines were re-emitted, so eg a LOGBOOK's
        // '- State "DONE" from "TODO" [...]' lines were silently dropped on save.
        const t = topic('T');
        t.drawers = { LOGBOOK: '- State "DONE"       from "TODO"       [2024-01-01 Mon 10:00]' };
        assert.ok(t.orgDrawers().includes('- State "DONE"'));
    });

    QUnit.test('orgTextwChildren', function (assert) {
        const t = topic('T', null, 'tnotes');
        link('https://a.com', 'A', t);
        const s = topic('S', t);
        link('https://b.com', 'B', s, 'bnotes');
        const sess = topic('Sess', t);
        sess.isSessionNode = true;
        assert.strictEqual(t.orgTextwChildren(),
            '* T\ntnotes\n\n** [[https://a.com][A]]\n\n** S\n\n*** [[https://b.com][B]]\nbnotes\n');
        assert.strictEqual(sess.orgTextwChildren(), '', 'session nodes never written');
    });

    QUnit.test('generateOrgFile: meta header, top level order from rows, no session nodes', function (assert) {
        setMetaProperties('#+PROPERTY: BTVersion 1\n');
        const a = topic('A');
        link('https://a.com', 'L', a);
        const b = topic('B');
        const sess = topic('Sess');
        sess.isSessionNode = true;
        assert.strictEqual(BTAppNode.generateOrgFile(),
            '#+PROPERTY: BTVersion 1\n* A\n\n** [[https://a.com][L]]\n\n* B\n', 'no rows => AllNodes order');
        renderRows([b, a]);
        assert.strictEqual(BTAppNode.generateOrgFile(),
            '#+PROPERTY: BTVersion 1\n* B\n\n* A\n\n** [[https://a.com][L]]\n', 'rows => display order');
    });
});

QUnit.module('BTLinkNode', function () {

    QUnit.test('basics', function (assert) {
        const p = topic('P', null, 'see [[https://a.com][A]] here');
        const l = new BTLinkNode('[[https://a.com][A]]', p.id, '', 2, 'https');
        assert.strictEqual(l.protocol, 'https');
        l.protocol = 'http';
        assert.strictEqual(l.protocol, 'http');
        assert.strictEqual(l.URL, 'https://a.com');
        assert.notOk(l.isTopic());
        new BTAppNode('[[https://b.com][B]]', l.id, '', 3);
        assert.notOk(l.isTopic(), 'never a topic, even with children');
        assert.deepEqual(p.childIds, [l.id]);
    });

    QUnit.test('not written to org until it has text', function (assert) {
        const p = topic('P', null, 'see [[https://a.com][A]] here');
        const l = new BTLinkNode('[[https://a.com][A]]', p.id, '', 2, 'https');
        assert.strictEqual(l.orgTextwChildren(), '');
        assert.strictEqual(p.orgTextwChildren(), '* P\nsee [[https://a.com][A]] here\n', 'no blank entry for the link');
    });

    QUnit.test('adding text promotes it and de-links the parent text', function (assert) {
        const p = topic('P', null, 'see [[https://a.com][A]] here');
        const l = new BTLinkNode('[[https://a.com][A]]', p.id, '', 2, 'https');
        l.text = 'my notes';
        assert.strictEqual(l.text, 'my notes');
        assert.strictEqual(p.text, 'see [https://a.com][A] here', 'no duplicate link on next load');
        assert.strictEqual(l.orgTextwChildren(), '** [[https://a.com][A]]\nmy notes\n');
    });
});

QUnit.module('BTAppNode: search helpers (model side)', function () {

    QUnit.test('_orgTextToHTML', function (assert) {
        const h = BTAppNode._orgTextToHTML;
        assert.strictEqual(h('Word [[http://a.com][A]] end'),
            "Word <a href='http://a.com' class='btlink'><span class='btTitleText'>A</span></a> end");
        assert.strictEqual(h('[[http://a.com][A]]', 'KW '),
            "<a href='http://a.com' class='btlink'><span class='btTitleText'>KW A</span></a>", 'keyword goes inside the link');
        assert.strictEqual(h('plain', 'KW '), 'KW plain');
        assert.strictEqual(h('see [[id:123][Other]]'), "see <span class='file-link'>Other</span>", 'org id links are not hrefs');
    });

    QUnit.test('_orgTextToHTML converts every link, not just the first', function (assert) {
        // Was bug 12: reg.exec ran once, so in notes (displayText) only the first link became
        // an <a>; later ones showed as raw [[url][label]].
        const out = BTAppNode._orgTextToHTML('[[http://a.com][A]] and [[http://b.com][B]]');
        assert.notOk(out.includes('[['), out);
        assert.strictEqual(BTAppNode._orgTextToHTML('[[http://a.com][A]] and [[http://b.com][B]]', 'KW '),
            "<a href='http://a.com' class='btlink'><span class='btTitleText'>KW A</span></a> and " +
            "<a href='http://b.com' class='btlink'><span class='btTitleText'>B</span></a>", 'keyword only in the first');
    });

    QUnit.test('escapeRegExp', function (assert) {
        assert.strictEqual(BTAppNode.escapeRegExp('a.b*c+?^$(x)[y]{z}|\\'), 'a\\.b\\*c\\+\\?\\^\\$\\(x\\)\\[y\\]\\{z\\}\\|\\\\');
        assert.ok(new RegExp(BTAppNode.escapeRegExp('c++')).test('I like c++'));
    });

    QUnit.test('search() matches title, url, notes and keyword, case-insensitively', function (assert) {
        const t = topic('Parent');
        const l = link('https://example.com/page', 'Readable Title', t, 'Some notes about Widgets');
        assert.ok(l.search('readable'), 'title');
        assert.ok(l.search('example.com'), 'url');
        assert.ok(l.search('WIDGETS'), 'notes');
        assert.notOk(l.search('absent'), 'no match');
        assert.notOk(l.search('a.c'), 'regex chars are literal');
        l.keyword = 'TODO';
        assert.ok(l.search('todo'), 'keyword');
        assert.notOk(l.search('readable', true), 'filtering on and row not visible-by-filter => skipped');
    });

    QUnit.test('extendedSearch / redisplaySearchedNodes bookkeeping', function (assert) {
        const t = topic('Parent');
        const a = link('https://a.com', 'Alpha', t, 'notes');
        const b = link('https://b.com', 'Beta', t, 'more alpha notes');
        const c = link('https://c.com', 'Gamma', t);
        [a, b, c].forEach(n => n.extendedSearch('alpha', true));
        assert.deepEqual([...BTAppNode.searchNodesToRedisplay].sort(), [a.id, b.id].sort());
        c.extendedSearch('c.com', true);
        assert.ok(BTAppNode.searchNodesToRedisplay.has(c.id), 'url match counts');
        BTAppNode.redisplaySearchedNodes();
        assert.strictEqual(BTAppNode.searchNodesToRedisplay.size, 0);
        const d = link('https://d.com', 'Delta', t);
        d.extendedSearch('delta');
        assert.strictEqual(BTAppNode.searchNodesToRedisplay.size, 0, 'not forced and not displayed => skipped');
    });

    QUnit.test('setDisplayOrder / nextDisplayNode wrap around', function (assert) {
        const a = topic('A');
        const b = link('https://b.com', 'B', a);
        const c = topic('C');
        renderRows([a, b, c]);
        BTAppNode.setDisplayOrder();
        assert.strictEqual(a.nextDisplayNode(), b);
        assert.strictEqual(b.nextDisplayNode(), c);
        assert.strictEqual(c.nextDisplayNode(), a, 'wraps forward');
        assert.strictEqual(a.nextDisplayNode(true), c, 'wraps backward');
        BTAppNode.resetDisplayOrder();
        assert.deepEqual(BTAppNode.displayOrder, {});
    });
});

QUnit.module('BTAppNode: outbound messages to the extension', function () {

    QUnit.test('showNode: tab, else group, else window', function (assert) {
        const n = topic('T');
        n.showNode();
        assert.strictEqual(calls.length, 0, 'nothing open => no message');
        n.windowId = 3;
        n.showNode();
        n._tabGroupId = 2;
        n.showNode();
        n.tabId = 1;
        n.showNode();
        assert.deepEqual(callsTo('sendMessage').map(c => c.args[0]), [
            { function: 'showNode', windowId: 3 },
            { function: 'showNode', tabGroupId: 2 },
            { function: 'showNode', tabId: 1 },
        ]);
    });

    QUnit.test('openPage: opens via background', function (assert) {
        const t = topic('T');
        t.windowId = 5;
        const l = link('https://a.com', 'A', t);
        l.openPage(true);
        assert.ok(l.opening, 'guards double open');
        assert.deepEqual(callsTo('incrementStat').map(c => c.args[0]), ['BTNumTabOperations']);
        assert.deepEqual(callsTo('callBackground').map(c => c.args[0]), [
            { function: 'openTabs', newWin: true, defaultWinId: 5, tabs: [{ nodeId: l.id, url: 'https://a.com' }] }]);
        l.openPage();
        assert.strictEqual(callsTo('callBackground').length, 1, 'second click while opening ignored');
    });

    QUnit.test('openPage: no URL or already open', function (assert) {
        const t = topic('T');
        t.openPage();
        assert.strictEqual(calls.length, 0, 'no URL => nothing');
        const l = link('https://a.com', 'A', t);
        l.tabId = 9;
        l.openPage();
        assert.strictEqual(callsTo('callBackground').length, 0);
        assert.deepEqual(callsTo('sendMessage')[0].args[0], { function: 'showNode', tabId: 9 }, 'already open => show it');
    });

    QUnit.test('openPage: newWin suppressed when the topic already has an open tab group', function (assert) {
        const t = topic('T');
        link('https://open.com', 'O', t).tabId = 7;
        const l = link('https://a.com', 'A', t);
        l.openPage(true);
        assert.strictEqual(callsTo('callBackground')[0].args[0].newWin, false, 'default mode is TABGROUP');
        l.opening = false;
        setProp('BTGroupingMode', 'NONE');
        resetCalls();
        l.openPage(true);
        assert.strictEqual(callsTo('callBackground')[0].args[0].newWin, true, 'not in NONE mode');
    });

    QUnit.test('openPage / openTopicTree: topic tree links load the org file', function (assert) {
        const url = 'https://braintool.org/topicTrees/x.org';
        const tt = link(url, 'Tree', topic('T'));
        tt.openPage();
        assert.deepEqual(callsTo('loadOrgFile').map(c => c.args[0]), [url]);
        assert.strictEqual(callsTo('callBackground').length, 0);
        link('https://a.com', 'child', tt);
        window.testConfirmAnswer = false;
        tt.openPage();
        assert.strictEqual(window.testConfirms.length, 1, 'already loaded => confirm');
        assert.strictEqual(callsTo('loadOrgFile').length, 1, 'declined => not reloaded');
    });

    QUnit.test('openAll: tab groups by default, plain tabs in NONE mode or for trash', function (assert) {
        const t = topic('T');
        const a = link('https://a.com', 'A', t);
        t.openAll();
        assert.deepEqual(callsTo('sendMessage')[0].args[0], {
            function: 'openTabGroups', newWin: false, tabGroups: [
                { tabGroupId: 0, windowId: 0, groupName: 'T', tabGroupTabs: [{ nodeId: a.id, url: 'https://a.com' }] }] });
        resetCalls();
        setProp('BTGroupingMode', 'NONE');
        t.openAll(true);
        assert.deepEqual(callsTo('sendMessage')[0].args[0],
            { function: 'openTabs', newWin: true, tabs: [{ nodeId: a.id, url: 'https://a.com' }] });
        resetCalls();
        resetProps();
        const trash = topic('🗑️ TRASH');
        link('https://t.com', 'X', trash);
        trash.openAll();
        assert.strictEqual(callsTo('sendMessage')[0].args[0].function, 'openTabs', 'trash never grouped');
    });

    QUnit.test('groupAndPosition', async function (assert) {
        const t = topic('T');
        t.windowId = 1; t._tabGroupId = 5;
        const a = link('https://a.com', 'A', t);
        link('https://b.com', 'B', t);
        Object.assign(a, { tabId: 10, windowId: 1, tabIndex: 3 });
        setBackgroundResponse({ status: 'success', message: [{ id: 10, tabIndex: 7 }] });
        await t.groupAndPosition();
        assert.deepEqual(callsTo('callBackground').map(c => c.args[0]), [{
            function: 'groupAndPositionTabs', tabGroupId: 5, windowId: 1,
            tabInfo: [{ nodeId: a.id, tabId: 10, tabIndex: 3 }],
            groupName: 'T', topicId: t.id, leftmostTabIndex: 3 }]);
        assert.strictEqual(a.tabIndex, 7, 'tab indices updated from the response');
    });

    QUnit.test('groupAndPosition: no-ops', async function (assert) {
        const t = topic('T');
        const a = link('https://a.com', 'A', t);
        await a.groupAndPosition();
        t.trashed = true;
        await t.groupAndPosition();
        t.trashed = false;
        setProp('BTGroupingMode', 'NONE');
        await t.groupAndPosition();
        assert.strictEqual(calls.length, 0, 'not a topic / trashed / grouping off');
    });

    QUnit.test('putInGroup', function (assert) {
        const t = topic('T');
        t._tabGroupId = 5;
        const a = link('https://a.com', 'A', t);
        a.putInGroup();
        assert.strictEqual(calls.length, 0, 'no tab => nothing');
        Object.assign(a, { tabId: 10, windowId: 1, tabIndex: 2 });
        a.putInGroup();
        assert.deepEqual(callsTo('callBackground')[0].args[0], {
            function: 'groupAndPositionTabs', tabGroupId: 5, windowId: 1,
            tabInfo: [{ nodeId: a.id, tabId: 10, tabIndex: 2 }], groupName: 'T', topicId: t.id });
    });

    QUnit.test('closeTab closes the subtree', function (assert) {
        const t = topic('T');
        link('https://a.com', 'A', t).tabId = 1;
        const s = topic('S', t);
        link('https://b.com', 'B', s).tabId = 2;
        link('https://c.com', 'C', s);
        t.closeTab();
        assert.deepEqual(callsTo('sendMessage').map(c => c.args[0]),
            [{ function: 'closeTab', tabId: 1 }, { function: 'closeTab', tabId: 2 }]);
    });

    QUnit.test('updateTabGroup', async function (assert) {
        const t = topic('T');
        assert.strictEqual(await t.updateTabGroup(), undefined, 'no group => nothing');
        t._tabGroupId = 5; t.folded = true;
        await t.updateTabGroup();
        assert.deepEqual(callsTo('callBackground')[0].args[0],
            { function: 'updateGroup', tabGroupId: 5, collapsed: true, title: 'T' });
        window.Window.BrainTool.browserUpdate = true;
        await t.updateTabGroup();
        assert.strictEqual(callsTo('callBackground').length, 1, 'change came from browser => no echo');
        window.Window.BrainTool.browserUpdate = false;
        setBackgroundResponse({ status: 'error' });
        await t.updateTabGroup();
        assert.strictEqual(t.tabGroupId, 0, 'error => group forgotten');
    });

    QUnit.test('ungroupAll / groupOpenChildren / groupAll', function (assert) {
        const t = topic('T');
        t.windowId = 4;
        link('https://a.com', 'A', t).tabId = 1;
        link('https://b.com', 'B', t).tabId = 2;
        BTAppNode.ungroupAll();
        assert.deepEqual(callsTo('callBackground')[0].args[0], { function: 'ungroup', tabIds: [1, 2] });
        resetCalls();
        window.testConfirmAnswer = false;
        BTAppNode.ungroupAll();
        assert.strictEqual(calls.length, 0, 'declined');

        BTAppNode.groupAll();
        assert.deepEqual(callsTo('sendMessage').map(c => c.args[0]),
            [{ function: 'moveOpenTabsToTG', groupName: 'T', tabIds: [1, 2], windowId: 4 }], 'only nodes with open children');
    });

    QUnit.test('ungroupAll with nothing open does not ask', function (assert) {
        topic('T');
        BTAppNode.ungroupAll();
        assert.strictEqual(window.testConfirms.length, 0);
        assert.strictEqual(calls.length, 0);
    });
});

QUnit.module('BTAppNode: handleNodeMove and levels', function () {

    QUnit.test('moves between parents, updates level', function (assert) {
        const p1 = topic('P1');
        const p2 = topic('P2');
        const x = link('https://x.com', 'X', p2);
        const a = link('https://a.com', 'A', p1);
        a.handleNodeMove(p2.id, 0);
        assert.strictEqual(a.parentId, p2.id);
        assert.deepEqual(p2.childIds, [a.id, x.id]);
        assert.deepEqual(p1.childIds, []);
        const s = topic('S', p1);
        s.handleNodeMove(p2.id, 0);
        assert.strictEqual(s.level, 2);
        s.handleNodeMove(null);
        assert.strictEqual(s.level, 1, 'to top level');
        assert.strictEqual(calls.length, 0, 'closed nodes => no browser calls');
    });

    QUnit.test('open tab moved into a grouped topic is regrouped there', function (assert) {
        const p1 = topic('P1');
        const p2 = topic('P2');
        p2.windowId = 1; p2._tabGroupId = 22;
        const a = link('https://a.com', 'A', p1);
        Object.assign(a, { tabId: 10, windowId: 1, tabIndex: 0 });
        a.handleNodeMove(p2.id, 0);
        assert.strictEqual(a.tabGroupId, 22, 'inherits the new group');
        const bg = callsTo('callBackground').map(c => c.args[0]);
        assert.strictEqual(bg.length, 1);
        assert.strictEqual(bg[0].function, 'groupAndPositionTabs');
        assert.strictEqual(bg[0].topicId, p2.id);
    });

    QUnit.test('open tab moved into an ungrouped topic is put in a group', function (assert) {
        const p1 = topic('P1');
        const p2 = topic('P2');
        const a = link('https://a.com', 'A', p1);
        Object.assign(a, { tabId: 10, windowId: 1, tabIndex: 0 });
        a.handleNodeMove(p2.id, 0);
        const bg = callsTo('callBackground').map(c => c.args[0]);
        assert.strictEqual(bg.length, 1);
        assert.strictEqual(bg[0].groupName, 'P2');
        assert.strictEqual(bg[0].topicId, p2.id);
    });

    QUnit.test('browserAction moves do not echo back to the browser', function (assert) {
        const p1 = topic('P1');
        const p2 = topic('P2');
        p2._tabGroupId = 22;
        const a = link('https://a.com', 'A', p1);
        Object.assign(a, { tabId: 10, windowId: 1 });
        a.handleNodeMove(p2.id, 0, true);
        assert.strictEqual(a.parentId, p2.id);
        assert.strictEqual(calls.length, 0);
    });

    QUnit.test('moving into trash does not regroup', function (assert) {
        const p1 = topic('P1');
        const trash = topic('🗑️ TRASH');
        const a = link('https://a.com', 'A', p1);
        Object.assign(a, { tabId: 10, windowId: 1 });
        a.handleNodeMove(trash.id, 0);
        assert.strictEqual(calls.length, 0);
    });

    QUnit.test('handleNodeMove of an open top-level node does not throw', function (assert) {
        // Was bug 8: with oldParent undefined, oldParent.setTGColor(null) threw TypeError.
        // (newParent was also dereferenced unguarded when moving an open node to top level.)
        const lt = link('https://a.com', 'Link topic', null);
        Object.assign(lt, { tabId: 10, windowId: 1 });
        const p = topic('P');
        let threw = false;
        try { lt.handleNodeMove(p.id, 0, true); } catch { threw = true; }
        assert.notOk(threw);
        threw = false;
        try { lt.handleNodeMove(null, -1, true); } catch { threw = true; }
        assert.notOk(threw, 'and back to top level');
        assert.strictEqual(lt.level, 1);
    });

    QUnit.test('resetLevel cascades when rows are displayed', function (assert) {
        const t = topic('T');
        const s = topic('S', t);
        const l = link('https://a.com', 'A', s);
        renderRows([t, s, l]);
        s.resetLevel(1);
        assert.strictEqual(s.level, 1);
        assert.strictEqual(l.level, 2);
        assert.ok($(l.getDisplayNode()).find('span.indenter').attr('style').includes('* 1)'), 'indent updated');
    });

    QUnit.test('resetLevel cascades to descendants without a display row', function (assert) {
        // Was bug 7: resetLevel returned before the child loop when the node had no row, so a
        // moved, unrendered subtree kept its old levels (== org '*' depth).
        const t = topic('T');
        const s = topic('S', t);
        const l = link('https://a.com', 'A', s);
        s.handleNodeMove(null);
        assert.strictEqual(s.level, 1);
        assert.strictEqual(l.level, 2);
        assert.strictEqual(l.orgText(), '** [[https://a.com][A]]\n');
    });
});

QUnit.module('BTAppNode: aliases and favicons (stubbed storage)', function () {

    QUnit.test('storeAlias / findFromAlias', async function (assert) {
        const t = topic('T');
        const a = link('https://a.com/real', 'A', t);
        a.storeAlias('https://a.com/redirected');
        assert.ok(a.aliases.has('https://a.com/redirected'), 'in memory');
        assert.deepEqual(callsTo('localStorageManager.set')[0].args,
            ['https://a.com/redirected', 'https://a.com/real', 'aliasDB'], 'persisted alias -> url');
        assert.strictEqual(await BTAppNode.findFromAlias('https://a.com/redirected'), a);
        assert.strictEqual(await BTAppNode.findFromAlias('https://nope.com'), undefined);
    });

    QUnit.test('findFromAlias hydrates from the alias DB once', async function (assert) {
        const t = topic('T');
        const a = link('https://a.com/real', 'A', t);
        const b = link('https://a.com/real', 'A again', topic('U'));
        seedDB('aliasDB', { 'https://short/1': 'https://a.com/real', 'https://short/2': 'https://unknown.com' });
        assert.strictEqual(await BTAppNode.findFromAlias('https://short/1'), a);
        assert.ok(b.aliases.has('https://short/1'), 'every node with that url gets the alias');
        assert.strictEqual(await BTAppNode.findFromAlias('https://short/2'), undefined, 'alias for a url not in the tree');
        assert.ok(BTAppNode._aliasesLoaded);
    });

    QUnit.test('storeFavicon keys on url without query/hash', function (assert) {
        const a = link('https://a.com/p?q=1#h', 'A', topic('T'));
        a.faviconUrl = 'https://a.com/favicon.ico';
        a.storeFavicon();
        assert.deepEqual(callsTo('localStorageManager.set')[0].args,
            ['https://a.com/p', 'https://a.com/favicon.ico', 'faviconDB']);
    });
});

QUnit.start();
