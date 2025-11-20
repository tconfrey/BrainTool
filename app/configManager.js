/***
*
* Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
*
* This file is part of the BrainTool browser manager extension, open source licensed under the GNU AGPL license.
* See the LICENSE file contained with this project.
*
***/



/*** 
* 
* Handles configuration/actions/help getting/setting and associated displays. 
* Config can come from
* 1) config.js embedded in extension package and passed in msg
* 2) Config obj kept in local storage
* 3) metaProps - Org properties read from bt.org file and stored as properties on AllNodes[]
* 4) stats, listed, but stored in local storage under the BTStats property
* NB BTId is both in meta and local for recovery purposes
* 
***/
'use strict';

import { sendMessage } from './extensionMessaging.js';

// Module-level private state (was inside IIFE)
const Properties = {
    'keys': ['CLIENT_ID', 'API_KEY', 'FB_KEY', 'STRIPE_KEY'],
    'localStorageProps': ['BTId', 'BTTimestamp', 'BTFileID', 'BTAppVersion', 'BTGDriveConnected', 'BTStats',
                          'BTLastShownMessageIndex', 'BTManagerHome', 'BTStickyTabs', 'BTTheme', 'BTFavicons',
                          'BTNotes', 'BTDense', 'BTSize', 'BTTooltips', 'BTGroupingMode', 'BTDontShowIntro',
                          'BTExpiry', 'BTBackupsOn', 'BTBackupsList', 'BTMoreToolsOn', 'BTFileText', 'BTMoreToolsOn',
                          'mruTopics'],
    'orgProps': ['BTCohort',  'BTVersion', 'BTId'],
    'stats': ['BTNumTabOperations', 'BTNumSaves', 'BTNumLaunches', 'BTInstallDate', 'BTSessionStartTime',
              'BTLastActivityTime', 'BTSessionStartSaves', 'BTSessionStartOps', 'BTDaysOfUse'],
    'sessionVars': ['InitialInstall', 'BTTabId', 'BTWindowId']
};
let Config = {};
let Keys = {CLIENT_ID: '', API_KEY: '', FB_KEY: '', STRIPE_KEY: ''};
let SessionVars = {};

function setConfigAndKeys(msg) {
    // takes message from background/Content script and pulls out settings
    Config = msg.Config || {};
    if (!Config['BTStats']) Config['BTStats'] = {};
    if (msg.SidePanel) Config['BTManagerHome'] = 'SIDEPANEL';
    if (msg.BTVersion) Config['BTAppVersion'] = msg.BTVersion;
    Keys.CLIENT_ID = msg.client_id;
    Keys.API_KEY = msg.api_key;
    Keys.FB_KEY = msg.fb_key;
    Keys.STRIPE_KEY = msg.stripe_key;
}

function setProp(prop, value) {
    // setter for property. extensionProps cannot be set

    const storeData = {};

    if (Properties.localStorageProps.includes(prop)) {
        if (value === undefined) {
            delete Config[prop];
        } else {
            Config[prop] = value;
        }
        storeData[prop] = value;
    }
    if (Properties.orgProps.includes(prop)) {
        Config[prop] = value;
    }
    if (Properties.stats.includes(prop)) {
        Config['BTStats'][prop] = value;
        storeData.BTStats = { ...Config['BTStats'] };
    }
    if (Properties.sessionVars.includes(prop)) {
        SessionVars[prop] = value;
    }

    if (Object.keys(storeData).length) {
        storeData.Config = { ...Config };
        sendMessage({'function': 'localStore', 'data': storeData});
    }
};

function getProp(prop) {
    // getter for sync props, fetch from appropriate place based on Config array above
    
    if (Properties.localStorageProps.includes(prop)) {
        return Config[prop];
    }
    if (Properties.orgProps.includes(prop)) {
        return Config[prop];
    }
    if (Properties.keys.includes(prop)) {
        return Keys[prop];
    }
    if (Properties.stats.includes(prop) && Config.BTStats) {
        return Config.BTStats[prop];
    }
    if (Properties.sessionVars.includes(prop)) {
        return SessionVars[prop];
    }
    return null;
};

function metaPropertiesToString() {
    // return the string to be used to output meta properties to .org file
    let str = "";    
    Properties['orgProps'].forEach(function(prop) {
        if (getProp(prop)) 
            str += `#+PROPERTY: ${prop} ${getProp(prop)}\n`;
    });
    return str;
}

function checkNewDayOfUse(prev, current) {
    // last active timestamp same day as this timestamp?
    const prevDate = new Date(prev).toLocaleDateString();           // eg 2/8/1966
    const currentDate = new Date(current).toLocaleDateString();
    if (prevDate != currentDate) {
        const oldDaysOfUse = Config['BTStats']['BTDaysOfUse'] || 0;
        Config['BTStats']['BTDaysOfUse'] = oldDaysOfUse + 1;
        gtag('event', 'DayOfUse', {'event_category': 'Usage', 'event_label': 'NumDaysOfUse', 'value': Config['BTStats']['BTDaysOfUse']});
    }
}

function incrementStat(statName) {
    // numLaunches, numSaves, numTabOps, update lastactivity as side effect
    const oldVal = Config['BTStats'][statName] || 0;
    const date = Date.now();
    const previousActivityTime = Config['BTStats']['BTLastActivityTime'] || 0;
    Config['BTStats'][statName] = oldVal + 1;
    Config['BTStats']['BTLastActivityTime'] = date;
    checkNewDayOfUse(previousActivityTime, date);                   // see above
    sendMessage({
        'function': 'localStore',
        'data': {
            Config: { ...Config },
            BTStats: { ...Config['BTStats'] }
        }
    });
};

function setStat(statName, statValue) {
    // just another prop eg sessionStartTime
    setProp(statName, statValue);
};  


function initializeInstallDate() {
    // best guess at install date cos wasn't previously set
    // Use bookmark import data if set. Otherwise assume 2x saves/day up to 1 year
    if (Config['BTStats']['BTInstallDate']) return;
    const saveDays = Math.min(Config['BTStats']['BTNumSaves'] / 2, 365);
    const guessedInstallDate = Date.now() - (saveDays * 24 * 60 * 60000);
    setProp('BTInstallDate', guessedInstallDate);
}



// Export individual functions instead of a single object
export {
    setConfigAndKeys,
    setProp,
    getProp,
    metaPropertiesToString,
    setStat,
    incrementStat,
    initializeInstallDate
};

