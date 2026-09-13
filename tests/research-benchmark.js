// Deterministic payload comparison, NOT a token/cost or human-time benchmark.
import assert from 'node:assert/strict';
import {AllNodes} from '../app/BTNode.js';
import {researchFixture} from './research-fixture.js';
import {createResearchScope} from '../app/webmcpResearch.js';

const {root} = researchFixture();
const scope = createResearchScope(() => AllNodes, root.id, 'benchmark');
const full = AllNodes.filter(n => n && n.id !== AllNodes.at(-1).id).map(n => ({title: n.displayTopic, url: n.URL, note: n.text || ''}));
const complete = scope.list();
const walkthrough = [complete, ...complete.items.map(topic => scope.read({reference: topic.reference}))];
const query = 'cannot preserve';
const selected = scope.search({query});
const baselineMatches = full.filter(n => `${n.title}\n${n.url}\n${n.note}`.toLowerCase().includes(query));
assert.equal(selected.total, baselineMatches.length);
assert.deepEqual(selected.items.map(n => n.url), baselineMatches.map(n => n.url));
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
console.log(JSON.stringify({node: process.version, platform: process.platform,
    conditions: 'Synthetic small corpus; exact JSON UTF-8 bytes; no LLM, network or timing. One deterministic measurement.',
    targetedQuestion: {expectedMatches: baselineMatches.length, observedMatches: selected.total,
        completeBaselineBytes: bytes(full), boundedSearchBytes: bytes(selected),
        apiCalls: 1},
    fullTraversal: {apiCalls: walkthrough.length, responseBytes: walkthrough.reduce((sum, result) => sum + bytes(result), 0)},
    interpretation: 'On small data, metadata and repeated navigation can outweigh selection savings. Payload size is not model token usage, reasoning quality or human completion time.'}, null, 2));
