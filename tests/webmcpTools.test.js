import test from 'node:test';
import assert from 'node:assert/strict';
import {registerResearchTools, researchTools} from '../app/webmcpTools.js';

test('unavailable API does not attempt a substitute transport', async () => {
    await assert.rejects(registerResearchTools(undefined, {}), /unavailable/);
});
test('all registrations are scoped to one abort lifetime', async () => {
    const registered = [];
    let revoked = false;
    const stop = await registerResearchTools({registerTool: async (tool, options) => registered.push({tool, options})}, {revoke() { revoked = true; }});
    assert.equal(registered.length, 3);
    assert.equal(new Set(registered.map(r => r.options.signal)).size, 1);
    stop();
    assert.equal(revoked, true);
    assert.ok(registered.every(r => r.options.signal.aborted));
});
test('partial registration failure rolls back authorization and registrations', async () => {
    let count = 0, signal, revoked = false;
    await assert.rejects(registerResearchTools({registerTool: async (_, options) => {
        signal = options.signal;
        if (++count === 2) throw new Error('Registration refused');
    }}, {revoke() { revoked = true; }}), /refused/);
    assert.ok(revoked && signal.aborted);
});
test('callback forwards valid input and rejects unknown fields', async () => {
    const tools = researchTools({search: args => args.query});
    assert.equal(await tools[1].execute({query: 'evidence'}), 'evidence');
    await assert.rejects(tools[1].execute({query: 'evidence', write: true}), /Unknown/);
    await assert.rejects(tools[1].execute(null), /Object/);
    await assert.rejects(tools[1].execute(JSON.parse('{"query":"evidence","__proto__":{}}')), /Unknown/);
});
