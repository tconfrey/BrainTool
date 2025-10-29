/***
*
* Copyright (c) 2019-2024 Tony Confrey, DataFoundries LLC
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
                          'BTExpiry', 'BTBackupsOn', 'BTBackupsList', 'BTMoreToolsOn'],
    'orgProps': ['BTCohort',  'BTVersion', 'BTId'],
    'stats': ['BTNumTabOperations', 'BTNumSaves', 'BTNumLaunches', 'BTInstallDate', 'BTSessionStartTime',
              'BTLastActivityTime', 'BTSessionStartSaves', 'BTSessionStartOps', 'BTDaysOfUse'],
    'sessionVars': ['InitialInstall']
};
let Config = {};
let Keys = {CLIENT_ID: '', API_KEY: '', FB_KEY: '', STRIPE_KEY: ''};
let SessionVars = {};

// Module-level state for subscription ID
let BTId = null;

// Callback for fileManager functions - registered after fileManager loads
let initiateBackupsCallback = null;
let authorizeGAPICallback = null;
let authorizeLocalFileCallback = null;

// Callback for UI functions - registered after UI loads
let toggleMoreButtonsCallback = null;
let groupingUpdateCallback = null;

function registerFileManager(callbacks) {
    // Called by fileManager to register its functions with configManager
    initiateBackupsCallback = callbacks.initiateBackups;
    authorizeGAPICallback = callbacks.authorizeGAPI;
    authorizeLocalFileCallback = callbacks.authorizeLocalFile;
}

function registerUI(callbacks) {
    // Called by UI code to register UI functions with configManager
    toggleMoreButtonsCallback = callbacks.toggleMoreButtons;
    groupingUpdateCallback = callbacks.groupingUpdate;
}

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
    
    if (Properties.localStorageProps.includes(prop)) {
        Config[prop] = value;       
        sendMessage({'function': 'localStore', 'data': {'Config': Config}});
    }
    if (Properties.orgProps.includes(prop)) {
        Config[prop] = value;
    }	 
    if (Properties.stats.includes(prop)) {
        Config['BTStats'][prop] = value;
        sendMessage({'function': 'localStore', 'data': {'Config': Config}});
    }
    if (Properties.sessionVars.includes(prop)) {
        SessionVars[prop] = value;
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

function isSidePanel() {
    // Check if BrainTool is running in side panel mode
    return Config.BTSidePanel || false;
}

function setSidePanel(value) {
    // Set whether BrainTool is running in side panel mode
    Config.BTSidePanel = value;
}

function getGroupingMode() {
    // Get the current tab grouping mode ('TABGROUP' or 'NONE')
    return Config.BTGroupingMode || 'TABGROUP';
}

function setGroupingMode(value) {
    // Set the tab grouping mode
    Config.BTGroupingMode = value;
}

function getBTId() {
    // Get the subscription ID
    return BTId;
}

function setBTId(value) {
    // Set the subscription ID and sync to Config
    BTId = value;
    setProp('BTId', value);
}

function checkNewDayOfUse(prev, current) {
    // last active timestamp same day as this timestamp?
    const prevDate = new Date(prev).toLocaleDateString();           // eg 2/8/1966
    const currentDate = new Date(current).toLocaleDateString();
    if (prevDate != currentDate) {
        const oldDaysOfUse = Config['BTStats']['BTDaysOfUse'] || 0;
        Config['BTStats']['BTDaysOfUse'] = oldDaysOfUse + 1;
        gtag('event', 'DayOfUse', {'event_category': 'Usage',
            'event_label': 'NumDaysOfUse',
            'value': Config['BTStats']['BTDaysOfUse']});
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
        sendMessage({'function': 'localStore', 'data': {'Config': Config}});
    };
    
    function setStat(statName, statValue) {
        // just another prop eg sessionStartTime
        setProp(statName, statValue);
    };  
    
    function updatePrefs() {
        // update preferences based on configuration
        
        // NB settings change is not visible any more but leaving ability to turn on via console for now
        let groupMode = getProp('BTGroupingMode');
        if (groupMode) {
            const $radio = $('#tabGroupToggle :radio[name=grouping]');
            $radio.filter(`[value=${groupMode}]`).prop('checked', true);
            setGroupingMode(groupMode);
        }
        
        let $radio;
        // does the topic manager live in a tab or a window?
        const managerHome = getProp('BTManagerHome') || 'WINDOW';
        $radio = $('#panelToggle :radio[name=location]');
        $radio.filter(`[value=${managerHome}]`).prop('checked', true);
        sendMessage({'function': 'localStore', 'data': {'BTManagerHome': managerHome}});
        
        // Fill in initial value for SettingsBackups checkbox
        const backupsOn = getProp('BTBackupsOn');
        $('#backups').prop('checked', backupsOn);
        
        // do we load Favicons? Read value, set ui and re-save in case defaulted
        const favSet = getProp('BTFavicons');
        const favicons = favSet || 'ON';
        $radio = $('#faviconToggle :radio[name=favicon]');
        $radio.filter(`[value=${favicons}]`).prop('checked', true);
        if (!favSet) setProp('BTFavicons', favicons);
        
        /*
        // Sticky Tabs?
        const sticky = getProp('BTStickyTabs') || 'STICKY';
        $radio = $('#stickyToggle :radio[name=sticky]');
        $radio.filter(`[value=${sticky}]`).prop('checked', true);
        setProp('BTStickyTabs', sticky);
        */
        
        // Dense?
        const dense = getProp('BTDense') || 'NOTDENSE';
        $radio = $('#denseToggle :radio[name=dense]');
        $radio.filter(`[value=${dense}]`).prop('checked', true);
        document.documentElement.setAttribute('data-dense', dense);
        
        // Large?
        const large = getProp('BTSize') || 'NOTLARGE';
        $radio = $('#largeToggle :radio[name=large]');
        $radio.filter(`[value=${large}]`).prop('checked', true);
        document.documentElement.setAttribute('data-size', large);
        
        // Tooltips?
        const tooltips = getProp('BTTooltips') || 'ON';
        $radio = $('#tooltipsToggle :radio[name=tooltips]');
        $radio.filter(`[value=${tooltips}]`).prop('checked', true);
        // do it
        if (tooltips == 'ON') {
            $("#buttonRow span").removeClass("wenk--off").addClass("wenk--left");
            $(".indenter a").removeClass("wenk--off").addClass("wenk--bottom");
            $("#topBar .filter-button").removeClass("wenk--off");
        } else {
            $("#buttonRow span").removeClass("wenk--left").removeClass("wenk--right").addClass("wenk--off");
            $(".indenter a").removeClass("wenk--bottom").addClass("wenk--off");
            $("#topBar .filter-button").addClass("wenk--off");
        }
        
        // More Tools?
        if (getProp('BTMoreToolsOn') == 'ON' && toggleMoreButtonsCallback) {
            toggleMoreButtonsCallback();
        }
        
        // Theme saved or set from OS
        const themeSet = getProp('BTTheme');
        const theme = themeSet ||
        (window?.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT');
        $radio = $('#themeToggle :radio[name=theme]');
        $radio.filter(`[value=${theme}]`).prop('checked', true);
        if (!themeSet) setProp('BTTheme', theme);
        // Change theme by setting attr on document which overides a set of vars. see top of bt.css
        document.documentElement.setAttribute('data-theme', theme);
        $('#topBar img').removeClass(['LIGHT', 'DARK']).addClass(theme);  // swap some icons
        $('#footer img').removeClass(['LIGHT', 'DARK']).addClass(theme);
    }
    
    // Register listener for radio button changes in Options, decide whether to nag
    $(document).ready(function () {
        $('#panelToggle :radio').change(function () {
            const newHome = $(this).val();
            setProp('BTManagerHome', newHome);
            // Let extension know
            sendMessage({'function': 'localStore', 'data': {'BTManagerHome': newHome}});
        });
        
        $('#tabGroupToggle :radio').change(function () {
            const oldVal = getGroupingMode();
            const newVal = $(this).val();
            setGroupingMode(newVal);
            setProp('BTGroupingMode', newVal);
            if (groupingUpdateCallback) groupingUpdateCallback(oldVal, newVal);
        });
        
        $('#syncSetting :radio').change(async function () {
            try {
                const newVal = $(this).val();
                let success = false;
                if (newVal == 'gdrive')
                    success = authorizeGAPICallback ? await authorizeGAPICallback(true) : false;
                else if (newVal == 'local')
                    success = authorizeLocalFileCallback ? await authorizeLocalFileCallback() : false;
                if (success) {
                    $("#settingsSync").hide();
                    $("#settingsSyncStatus").show();
                    $("#syncType").text((newVal == 'gdrive') ? "GDrive" : "Local File");
                    $("#actionsSyncStatus").show();
                } else {
                    $("#settingsSyncNone").prop("checked", true);
                }
                return success;
            } catch (err) {
                console.warn(err);
                $("#settingsSyncNone").prop("checked", true);
                return false;
            }
        });
        
        $('#settingsBackups :checkbox').change(async function () {
            const newVal = $(this).prop('checked');
            setProp('BTBackupsOn', newVal);
            setProp('BTBackupsList', {recent: [], daily: [], monthly: []});
            
            // Use callback instead of direct import to break circular dependency
            if (initiateBackupsCallback) {
                let success = await initiateBackupsCallback(newVal);
                if (!success) {
                    $(this).prop('checked', false);
                    setProp('BTBackupsOn', false);
                }
            } else {
                console.warn('initiateBackups callback not registered yet');
                $(this).prop('checked', false);
                setProp('BTBackupsOn', false);
            }
        });
        
        /*
        $('#stickyToggle :radio').change(function () {
        const newN = $(this).val();
        setProp('BTStickyTabs', newN);
        // No immediate action, take effect on next tabNavigated event
        });
        */
        
        $('#themeToggle :radio').change(function () {
            const newTheme = $(this).val();
            setProp('BTTheme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(newTheme);
            $('#footer img').removeClass(['DARK', 'LIGHT']).addClass(newTheme);
            // Let extension know
            sendMessage({'function': 'localStore', 'data': {'Theme': newTheme}});
        });
        
        $('#faviconToggle :radio').change(function () {
            const favicons = $(this).val();
            const favClass = (favicons == 'ON') ? 'faviconOn' : 'faviconOff';
            setProp('BTFavicons', favicons);
            // Turn on or off
            $('#content img').removeClass('faviconOff faviconOn').addClass(favClass);
        });
        
        $('#denseToggle :radio').change(function () {
            const newD = $(this).val();
            setProp('BTDense', newD);
            // do it
            document.documentElement.setAttribute('data-dense', newD);
        });
        
        $('#largeToggle :radio').change(function () {
            const newL = $(this).val();
            setProp('BTSize', newL);
            // do it
            document.documentElement.setAttribute('data-size', newL);
        });
        
        $('#tooltipsToggle :radio').change(function () {
            const newT = $(this).val();
            setProp('BTTooltips', newT);
            // do it
            if (newT == 'ON') {
                $("#buttonRow span").removeClass("wenk--off").addClass("wenk--left");
                $(".indenter a").removeClass("wenk--off").addClass("wenk--bottom");
                $("#topBar .filter-button").removeClass("wenk--off");
            } else {
                $("#buttonRow span").removeClass("wenk--left").removeClass("wenk--right").addClass("wenk--off");
                $(".indenter a").removeClass("wenk--bottom").addClass("wenk--off");
                $("#topBar .filter-button").addClass("wenk--off");
            }
        });
    });
    
    function toggleSettingsDisplay() {
        // open/close settings panel
        
        const iconColor = (getProp('BTTheme') == 'LIGHT') ? 'LIGHT' : 'DARK';
        const installDate = new Date(getProp('BTInstallDate'));
        const today = new Date();
        const daysSinceInstall = Math.floor((today - installDate) / (24 * 60 * 60 * 1000));
        
        if ($('#actions').is(':visible'))
            toggleActionsDisplay();                       // can't have both open
        
        if ($('#settings').is(':visible')) {            
            $('#settings').slideUp({duration: 250, 'easing': 'easeInCirc'});
            $("#content").fadeIn(250);
            $("body").css("overflow-y", "auto").css("overflow-x", "clip");
            setTimeout(() => {
                $('#settingsButton').removeClass('open');
                $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(iconColor);
            }, 250);
        } else {
            $('#settings').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#settingsButton').addClass('open');
            $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass('DARK');
            $("#content").fadeOut(250);
            $("body").css("overflow", "hidden");          // don't allow table to be scrolled
            
            // fade in and maybe out the overlay to shut off non-supporter features if not supporter
            if (getBTId()) return;
            // No BTId but might be still in trial period. Fade in overlay
            setTimeout(() => {
                $("#youShallNotPass").fadeIn();
            }, 1000);
            // fade out overlay if trial still on ie < 30 days since install
            if (daysSinceInstall <= 30)
                setTimeout(() => {$("#youShallNotPass").fadeOut(); scrollToPurchaseButtons()}, 10000);
        }
    }
    
    function closeConfigDisplays() {
        // close if open
        if ($('#actions').is(':visible')) toggleActionsDisplay();
        if ($('#settings').is(':visible')) toggleSettingsDisplay();
        if ($('#help').is(':visible')) toggleHelpDisplay();
    }
    
    function toggleActionsDisplay() {
        // open/close actions panel
        
        const iconColor = (getProp('BTTheme') == 'LIGHT') ? 'LIGHT' : 'DARK';
        
        if ($('#actions').is(':visible')) {            
            $('#actions').slideUp({duration: 250, 'easing': 'easeInCirc'});
            $("#content").fadeIn(250);
            $("body").css("overflow-y", "auto").css("overflow-x", "clip");
            setTimeout(() => {
                $('#actionsButton').removeClass('open');
                $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(iconColor);
            }, 250);
        } else {
            $('#actions').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#actionsButton').addClass('open');
            $('#topBar img').removeClass(['LIGHT', 'DARK']).addClass('DARK');
            $("#content").fadeOut(250);
            $("body").css("overflow", "hidden");          // don't allow table to be scrolled
        }
    }
    
    function toggleHelpDisplay(panel) {
        // open/close help panel
        
        const iconColor = (getProp('BTTheme') == 'LIGHT') ? 'LIGHT' : 'DARK';
        if ($('#help').is(':visible')) {
            // now visible => action is close
            $('#help').slideUp({duration: 250, 'easing': 'easeInCirc'});
            $("#content").fadeIn(250);
            $("body").css("overflow-y", "auto").css("overflow-x", "clip");
            setTimeout(() => {
                $('#footerHelp').removeClass('open');
                $('#footer img').removeClass(['LIGHT', 'DARK']).addClass(iconColor);
            }, 250);
        } else {
            // now visible => action is open
            $('#help').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#footerHelp').addClass('open');
            $('#footer img').removeClass(['LIGHT', 'DARK']).addClass('DARK');
            $("#content").fadeOut(250);
            $("body").css("overflow", "hidden");          // don't allow table to be scrolled
        }
    }
    
    function toggleKeyCommands() {
        // open/close key command table inside help
        if ($('#keyCommands').is(':visible'))
            setTimeout(()=>$('#keyCommands').slideUp({duration: 250, 'easing': 'easeInCirc'}),10);
        else
            setTimeout(()=>$('#keyCommands').slideDown({duration: 250, 'easing': 'easeInCirc'}), 10);
    }
    
    function initializeInstallDate() {
        // best guess at install date cos wasn't previously set
        // Use bookmark import data if set. Otherwise assume 2x saves/day up to 1 year
        if (Config['BTStats']['BTInstallDate']) return;
        const saveDays = Math.min(Config['BTStats']['BTNumSaves'] / 2, 365);
        const guessedInstallDate = Date.now() - (saveDays * 24 * 60 * 60000);
        setProp('BTInstallDate', guessedInstallDate);
    }
    
    function potentiallyNag() {
        // Nagging check, called on startup
        if (getBTId()) return;
        const installDate = new Date(getProp('BTInstallDate'));
        const today = new Date();
        const daysSinceInstall = Math.floor((today - installDate) / (24 * 60 * 60 * 1000));
        if (daysSinceInstall > 30) {
            openTrialExpiredWarning();
            $('#settingsBackups :checkbox').prop('checked', false);
            setProp('BTBackupsOn', false);
        }
    }
    
    function openTrialExpiredWarning() {
        // show trial expired warning section and call to arms, slide tree down to accomodate
        $("#trialExpiredWarning").show();
        $("#content").css("margin-top", "220px");
    }
    function closeTrialExpiredWarning() {
        // user closed warning - close it, reposition tree, open settings and scroll to subscribe section
        $("#trialExpiredWarning").hide();
        $("#content").css("margin-top", "79px");
        toggleSettingsDisplay();
        scrollToPurchaseButtons();
    }
    
    function scrollToPurchaseButtons() {
        // scroll to the purchase buttons in the settings panel
        // Delay to allow any previous animation to complete
        const settingsDiv = $('#settings');
        setTimeout(()=>settingsDiv.animate({ scrollTop: settingsDiv.prop('scrollHeight') }, 800, 'swing'), 800);
    }
    
    // Export public API (was previously returned from IIFE)
    const configManager = {
        setConfigAndKeys,
        setProp,
        getProp,
        metaPropertiesToString,
        setStat,
        incrementStat,
        updatePrefs,
        toggleSettingsDisplay,
        toggleHelpDisplay,
        toggleActionsDisplay,
        closeConfigDisplays,
        toggleKeyCommands,
        initializeInstallDate,
        closeTrialExpiredWarning,
        potentiallyNag,
        registerFileManager,
        registerUI,
        isSidePanel,
        setSidePanel,
        getGroupingMode,
        setGroupingMode,
        getBTId,
        setBTId
    };
    
    export { configManager };
    
