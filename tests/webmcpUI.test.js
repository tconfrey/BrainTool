import test from 'node:test';
import assert from 'node:assert/strict';
import {BTNode, AllNodes} from '../app/BTNode.js';

// Minimal DOM event harness: exercises the actual UI module and native adapter,
// without claiming to validate browser rendering or native WebMCP support.
class Element {
    children = []; listeners = new Map(); disabled = false; value = '';
    setAttribute(name, value) { this[name] = value; }
    append(...children) {
        this.children.push(...children);
        if (!this.value && children[0]?.value) this.value = children[0].value;
    }
    replaceChildren() { this.children = []; this.value = ''; }
    get options() { return this.children; }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    fire(type) { return this.listeners.get(type)?.(); }
}

let sequence = 0;
async function setup(t, modelContext) {
    const previousDocument = globalThis.document, previousWindow = globalThis.window;
    const elements = [];
    globalThis.document = {modelContext, body: new Element(), createElement: () => {
        const element = new Element(); elements.push(element); return element;
    }};
    globalThis.window = new Element();
    AllNodes.length = 0;
    new BTNode('Research');
    t.after(() => {
        globalThis.document = previousDocument;
        globalThis.window = previousWindow;
    });
    await import(`../app/webmcpUI.js?test=${++sequence}`);
    return {find: label => elements.find(e => e.textContent === label), window: globalThis.window,
        select: elements.find(e => e['aria-label']), status: elements.find(e => e.role === 'status')};
}

test('unavailable native API leaves sharing disabled and topics inspectable', async t => {
    const ui = await setup(t, undefined);
    assert.equal(ui.find('Enable read access').disabled, true);
    assert.equal(ui.select.options.length, 1);
    assert.match(ui.status.textContent, /unavailable/);
});

test('repeated activation during asynchronous registration cannot duplicate tools', async t => {
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const registrations = [];
    const ui = await setup(t, {registerTool: async (tool, options) => {
        registrations.push({tool, options}); await waiting;
    }});
    const enable = ui.find('Enable read access');
    const activation = enable.fire('click');
    await enable.fire('click');
    assert.equal(registrations.length, 1);
    assert.ok(ui.select.disabled);
    assert.ok(ui.find('Refresh topics').disabled);
    release(); await activation;
    assert.equal(registrations.length, 3);
    ui.find('Disable read access').fire('click');
    assert.ok(registrations.every(r => r.options.signal.aborted));
    await assert.rejects(registrations[0].tool.execute({}), /revoked|invalid/i);
    assert.equal(enable.disabled, false);
});

test('leaving during registration immediately cancels access and restored page can reactivate', async t => {
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    const registrations = [];
    const ui = await setup(t, {registerTool: async (tool, options) => {
        registrations.push({tool, options}); await waiting;
    }});
    const enable = ui.find('Enable read access');
    const activation = enable.fire('click');
    ui.window.fire('pagehide');
    ui.window.fire('pageshow');
    assert.ok(registrations[0].options.signal.aborted);
    await assert.rejects(registrations[0].tool.execute({}), /revoked|invalid/i);
    release(); await activation;
    assert.equal(registrations.length, 1);
    assert.equal(enable.disabled, false);
    await enable.fire('click');
    assert.equal(registrations.length, 4);
    assert.equal(ui.find('Disable read access').disabled, false);
});
