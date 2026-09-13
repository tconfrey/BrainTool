import test from 'node:test';
import assert from 'node:assert/strict';
import {AllNodes} from '../app/BTNode.js';
import {researchFixture, pages} from './research-fixture.js';
import {createResearchScope} from '../app/webmcpResearch.js';

test('retrieval preserves cross-category references, URL variants and review states', () => {
    const {root} = researchFixture();
    const scope = createResearchScope(() => AllNodes, root.id, 'coverage');
    const topics = scope.list().items.filter(n => n.reference !== scope.list().authorizedRoot.reference);
    const links = topics.flatMap(topic => scope.read({reference: topic.reference}).items);
    assert.equal(links.length, 6); // six memberships, five distinct URLs
    const unique = new Map(links.map(link => [link.url, link]));
    assert.equal(unique.size, pages.length);
    assert.equal(links.filter(link => link.url.endsWith('/shared.html')).length, 2);
    assert.ok([...unique.keys()].some(url => url.includes('?language=en')));
    const states = [...unique.values()].map(link => link.savedNote);
    assert.equal(states.filter(note => note.startsWith('Review state: read.')).length, 3);
    assert.equal(states.filter(note => note.startsWith('Review state: unavailable.')).length, 1);
    assert.equal(states.filter(note => note.startsWith('Review state: discovered.')).length, 1);
    assert.equal(scope.search({query: 'cannot preserve'}).total, 1);
    assert.equal(scope.search({query: 'Unshared'}).total, 0);
});
