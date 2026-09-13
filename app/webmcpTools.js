/* BrainTool, AGPL-3.0-or-later. Native WebMCP registration, no polyfill. */
const pagination = {offset: {type: 'integer', minimum: 0}, limit: {type: 'integer', minimum: 1, maximum: 25}};

export function researchTools(scope) {
    return [
        ['list', 'braintool_list_topics', 'Explore BrainTool Topic Manager: start here to discover saved topics in the human-authorized subtree. Returns the scope, topic references and pagination. Use braintool_read_topic to navigate a topic.', {}, []],
        ['search', 'braintool_search', 'Search BrainTool Topic Manager saved titles, links and notes in the authorized subtree. Does not fetch web pages or inspect live browser tabs.',
            {query: {type: 'string', minLength: 1, maxLength: 200}}, ['query']],
        ['read', 'braintool_read_topic', 'Read a BrainTool Topic Manager topic and its immediate saved children. Obtain the reference from braintool_list_topics or braintool_search. References expire after changes.',
            {reference: {type: 'string', minLength: 1}}, ['reference']]
    ].map(([method, name, description, properties, required]) => ({
        name, description,
        inputSchema: {type: 'object', properties: {...pagination, ...properties}, required, additionalProperties: false},
        annotations: {readOnlyHint: true, untrustedContentHint: true},
        execute: async (args = {}) => {
            if (!args || Array.isArray(args) || typeof args !== 'object') throw new Error('Object arguments required');
            if (Object.keys(args).some(key => !Object.hasOwn({...pagination, ...properties}, key))) throw new Error('Unknown argument');
            return scope[method](args);
        }
    }));
}

/** Registration uses the September 2026 draft AbortSignal lifetime contract.
 * Revoking the scope also blocks callbacks already retained by a client.
 */
export async function registerResearchTools(modelContext, scope, controller = new AbortController()) {
    if (typeof modelContext?.registerTool !== 'function') throw new Error('Native WebMCP is unavailable');
    const stop = () => { scope.revoke(); controller.abort(); };
    try {
        for (const tool of researchTools(scope)) {
            controller.signal.throwIfAborted();
            await modelContext.registerTool(tool, {signal: controller.signal});
        }
        controller.signal.throwIfAborted();
        return stop;
    } catch (error) {
        stop();
        throw error;
    }
}
