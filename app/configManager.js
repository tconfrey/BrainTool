/*** 
 * 
 * Handles configuration getting/setting. Config can come from
 * 1) config.js embedded in extension package and passed in msg
 * 2) Config obj kept in local storage
 * 3) metaProps - Org properties read from bt.org file and stored as properties on AllNodes[]
 * 
 ***/
'use strict';

const configManager = (() => {

    const Properties = {
        'keys': ['CLIENT_ID', 'API_KEY', 'FB_KEY', 'STRIPE_KEY'],
        'localStorageProps': ['BTId', 'BTTimestamp', 'BTFileID'],
        'orgProps': ['BTCohort',  'BTVersion', 'BTGroupingMode', 'BTGDriveConnected', 'BTLastBookmarkImport', 'BTId', 'BTManagerHome', 'BTTheme']
    };
    let Config, Keys = {CLIENT_ID: '', API_KEY: '', FB_KEY: '', STRIPE_KEY: ''};                     

    function setConfigAndKeys(msg) {
        // takes message from background/Content script and pulls out settings
        Config = msg.Config || {};
        Keys.CLIENT_ID = msg.client_id;
        Keys.API_KEY = msg.api_key;
        Keys.FB_KEY = msg.fb_key;
        Keys.STRIPE_KEY = msg.stripe_key;
    }

    function setProp(prop, value) {
        // setter for property. extensionProps cannot be set

        if (Properties.localStorageProps.includes(prop)) {
            Config[prop] = value;       
	        window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
        }
        if (Properties.orgProps.includes(prop)) {
            setMetaProp(prop, value);                     // see parser.js
        }	 
    };

    function getProp(prop) {
        // getter for sync props

        if (Properties.orgProps.includes(prop)) {
            return getMetaProp(prop);
        }
        if (Properties.keys.includes(prop)) {
            return Keys[prop];
        }
        if (Properties.localStorageProps.includes(prop)) {
            return Config[prop];
        }
        alert(`unknown prop: ${prop}`);
    };

    return {
        setConfigAndKeys: setConfigAndKeys,
        setProp: setProp,
        getProp: getProp
    };
})();

    
