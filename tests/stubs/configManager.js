/***
 *
 * Test stub for app/configManager.js. Props live in a plain object tests can seed via setProp
 * and clear via resetProps.
 *
 ***/
'use strict';

import { record } from './callLog.js';

const props = {};
let metaProps = '';

function getProp(name) {
    return props[name];
}
function setProp(name, value) {
    props[name] = value;
}
function resetProps() {
    Object.keys(props).forEach(k => delete props[k]);
    metaProps = '';
}
function setMetaProperties(str) {
    // what metaPropertiesToString returns, ie the org file header line(s)
    metaProps = str;
}
function metaPropertiesToString() {
    return metaProps;
}
function incrementStat(name) {
    record('incrementStat', name);
}
function setStat(name, value) {
    record('setStat', name, value);
}
function setConfigAndKeys() {}
function initializeInstallDate() {}

export { setConfigAndKeys, setProp, getProp, metaPropertiesToString, setStat, incrementStat,
         initializeInstallDate, resetProps, setMetaProperties };
