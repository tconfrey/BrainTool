import test from 'node:test';
import assert from 'node:assert/strict';
import {BTNode, AllNodes} from '../app/BTNode.js';
import {createResearchScope} from '../app/webmcpResearch.js';

function fixture() {
    AllNodes.length = 0;
    const root = new BTNode('Research');
    const topic = new BTNode('Evidence', root.id);
    const link = new BTNode('[[https://example.org/a][Source A]]', topic.id);
    link.text = 'Claim: available; contradictory evidence remains unresolved.';
    const privateNode = new BTNode('Private');
    const session = new BTNode('Live tabs', root.id);
    session.isSessionNode = true;
    const scope = createResearchScope(() => AllNodes, root.id, 'test-unique');
    return {root, topic, link, privateNode, scope};
}
test('projects actual BTNode topics and saved evidence, without other roots or live tabs', () => {
    const {scope} = fixture();
    assert.deepEqual(scope.list().items.map(n => n.title), ['Research', 'Evidence']);
    assert.equal(scope.search({query: 'Private'}).total, 0);
    const result = scope.search({query: 'contradictory'});
    assert.equal(result.total, 1);
    assert.equal(result.retrievedPageContent, false);
    assert.equal(result.application, 'BrainTool Topic Manager');
    assert.equal(result.authorizedRoot.title, 'Research');
    assert.match(result.navigation, /braintool_read_topic/);
});
test('reads selected topic, paginates, and does not mutate the tree', () => {
    const {scope} = fixture();
    const before = JSON.stringify(AllNodes);
    const first = scope.list({limit: 1});
    assert.equal(first.nextOffset, 1);
    const topic = scope.list({offset: 1, limit: 1}).items[0];
    assert.equal(scope.read({reference: topic.reference}).total, 1);
    assert.equal(JSON.stringify(AllNodes), before);
});
test('rejects invalid limits, queries and references', () => {
    const {scope} = fixture();
    for (const limit of [0, -1, 26, 1.5]) assert.throws(() => scope.list({limit}));
    assert.throws(() => scope.search({query: ''}));
    assert.throws(() => scope.read({reference: 'other:1'}));
});
test('editing saved evidence revokes the original scope', () => {
    const {scope, link} = fixture();
    link.text = 'Changed';
    assert.throws(() => scope.list(), /Scope changed/);
    assert.throws(() => scope.list(), /revoked/);
});
test('rebuilding even identical nodes invalidates references', () => {
    const {scope, topic} = fixture();
    AllNodes[topic.id] = Object.assign(Object.create(Object.getPrototypeOf(topic)), topic);
    assert.throws(() => scope.list(), /Scope changed/);
});
test('human revocation immediately stops reads', () => {
    const {scope} = fixture();
    scope.revoke();
    assert.throws(() => scope.list(), /revoked/);
});
test('a temporarily missing root cannot silently restore an invalid scope', () => {
    const {scope, root} = fixture();
    delete AllNodes[root.id];
    assert.throws(() => scope.list(), /unavailable/);
    AllNodes[root.id] = root;
    assert.throws(() => scope.list(), /revoked/);
});
test('large saved notes are explicitly truncated and stay plain text', () => {
    const {root, link} = fixture();
    link.text = '<script>not executable</script>' + 'x'.repeat(3000);
    const scope = createResearchScope(() => AllNodes, root.id, 'bounded');
    const item = scope.search({query: 'not executable'}).items[0];
    assert.equal(item.savedNote.length, 2048);
    assert.equal(item.truncated, true);
    assert.match(item.savedNote, /^<script>/);
});
