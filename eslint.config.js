'use strict';

// ESLint config for BrainTool. Dev-only tool - not loaded by the extension or app.
// Scope: app/ and extension/ source, excluding vendored third-party code and /versions
// (historical snapshots, see CLAUDE.md). The goal is catching references to functions/
// variables that aren't actually in scope - imports that don't exist, exports that got
// renamed, globals that were never declared - the class of bug that otherwise only
// surfaces when a user clicks the right button.

const jsBrowserGlobals = {
    window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
    history: 'readonly', console: 'readonly', alert: 'readonly', confirm: 'readonly',
    prompt: 'readonly', fetch: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
    setInterval: 'readonly', clearInterval: 'readonly', requestAnimationFrame: 'readonly',
    localStorage: 'readonly', sessionStorage: 'readonly', indexedDB: 'readonly',
    XMLHttpRequest: 'readonly', FormData: 'readonly', URL: 'readonly',
    URLSearchParams: 'readonly', DOMParser: 'readonly', Blob: 'readonly',
    FileReader: 'readonly', Node: 'readonly', Element: 'readonly', Event: 'readonly',
    CustomEvent: 'readonly', MouseEvent: 'readonly', KeyboardEvent: 'readonly',
    Window: 'readonly', crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
    structuredClone: 'readonly', getComputedStyle: 'readonly', MutationObserver: 'readonly',
    ResizeObserver: 'readonly', IntersectionObserver: 'readonly', AbortController: 'readonly',
    performance: 'readonly', matchMedia: 'readonly', showSaveFilePicker: 'readonly',
    Notification: 'readonly', requestIdleCallback: 'readonly', cancelIdleCallback: 'readonly',
    screen: 'readonly', self: 'readonly', Headers: 'readonly',
};

const jqueryGlobals = { '$': 'readonly', jQuery: 'readonly' };

const extensionGlobals = {
    chrome: 'readonly', gapi: 'readonly', google: 'readonly',
};

const commonRules = {
    'no-undef': 'error',
    'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
};

export default [
    {
        ignores: [
            'versions/**',                  // historical snapshots, see CLAUDE.md
            'node_modules/**',
            'app/orga-bundlev2.js',         // vendored org-mode parser
            'app/jquery.treetable.js',      // vendored (forked) treetable widget
            'extension/awesomplete.js',     // vendored
            'tests/**',                     // pre-refactor QUnit harness, unmaintained - see CLAUDE.md
        ],
    },

    // app/ - ES modules throughout. gtag (Google Analytics), orgaparse (orga-bundlev2.js) and
    // getDateString/tabsToBT (utilities/converters.js) arrive as classic-script globals via
    // index.html script tags loaded ahead of the module scripts. gapi/google/firebase/Stripe
    // are loaded at runtime by fileManager/subscriptionManager injecting their SDK scripts
    // into the page on demand.
    {
        files: ['app/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...jsBrowserGlobals, ...jqueryGlobals,
                gtag: 'readonly', getDateString: 'readonly', tabsToBT: 'readonly',
                orgaparse: 'readonly', gapi: 'readonly', google: 'readonly',
                firebase: 'readonly', Stripe: 'readonly',
            },
        },
        rules: commonRules,
    },

    // extension/ - the ES module subset (background.js and what it imports). Runs as a
    // service worker (self, not window) except for functions passed to
    // chrome.scripting.executeScript({func: ...}), which run injected into a tab's page -
    // a different global scope again. Those spots need a scoped eslint-disable, not a global.
    {
        files: [
            'extension/background.js',
            'extension/bookmarkHandler.js',
            'extension/config.js',
            'extension/configFallback.js',
        ],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: { ...jsBrowserGlobals, ...extensionGlobals },
        },
        rules: commonRules,
    },

    // popup.html: awesomplete.js (vendored, classic global) loads first, then popup.js as an
    // ES module that imports topicCard.js / topicSelector.js. topicSelector reads the vendored
    // Awesomplete global at runtime.
    {
        files: ['extension/popup.js', 'extension/topicCard.js', 'extension/topicSelector.js'],
        languageOptions: {
            ecmaVersion: 2024, sourceType: 'module',
            globals: {
                ...jsBrowserGlobals, ...jqueryGlobals, ...extensionGlobals,
                Awesomplete: 'readonly',
            },
        },
        rules: commonRules,
    },

    // extension/ classic scripts - btContentScript.js can't be an ES module under MV3
    // (content scripts don't support static imports) and sidePanel.js shares its page scope,
    // so each declares its own globals rather than drawing from one shared pool.

    // sidePanel.html: btContentScript.js, sidePanel.js
    {
        files: ['extension/sidePanel.js'],
        languageOptions: {
            ecmaVersion: 2024, sourceType: 'script',
            globals: {
                ...jsBrowserGlobals, ...jqueryGlobals, ...extensionGlobals,
                sendMessage: 'readonly',
            },
        },
        rules: commonRules,
    },
    {
        files: ['extension/btContentScript.js'],
        languageOptions: {
            ecmaVersion: 2024, sourceType: 'script',
            globals: { ...jsBrowserGlobals, ...jqueryGlobals, ...extensionGlobals },
        },
        rules: commonRules,
    },

    // utilities/ - standalone script, plain browser globals
    {
        files: ['utilities/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'script',
            globals: { ...jsBrowserGlobals },
        },
        rules: commonRules,
    },
];
