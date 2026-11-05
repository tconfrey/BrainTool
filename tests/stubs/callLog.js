/***
 *
 * Test-only call recorder shared by the stub modules in this directory.
 * Each stubbed function pushes {fn, args} here so tests can assert on outbound calls
 * (messages to the extension, stats, storage writes...) without a real extension.
 *
 ***/
'use strict';

const calls = [];

function record(fn, ...args) {
    calls.push({ fn, args });
}

function callsTo(fn) {
    // all recorded calls to fn, oldest first
    return calls.filter(c => c.fn === fn);
}

function resetCalls() {
    calls.length = 0;
}

export { calls, record, callsTo, resetCalls };
