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

const configManager = (() => {

    const Properties = {
        'keys': ['CLIENT_ID', 'API_KEY', 'FB_KEY', 'STRIPE_KEY'],
        'localStorageProps': ['BTId', 'BTTimestamp', 'BTFileID', 'BTStats', 'BTLastShownMessageIndex'],
        'orgProps': ['BTCohort',  'BTVersion', 'BTGroupingMode', 'BTGDriveConnected', 'BTLastBookmarkImport', 'BTId', 'BTManagerHome', 'BTTheme', 'BTFavicons', 'BTNotes', 'BTDense', 'BTSize'],
        'stats': ['BTNumTabOperations', 'BTNumSaves', 'BTNumLaunches', 'BTInstallDate', 'BTSessionStartTime', 'BTLastActivityTime', 'BTSessionStartSaves', 'BTSessionStartOps', 'BTDaysOfUse'],
    };
    let Config, Keys = {CLIENT_ID: '', API_KEY: '', FB_KEY: '', STRIPE_KEY: ''};                     

    function setConfigAndKeys(msg) {
        // takes message from background/Content script and pulls out settings
        Config = msg.Config || {};
        if (!Config['BTStats']) Config['BTStats'] = {};
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
            setMetaProp(prop, value);                                   // see parser.js
            saveBT();
        }	 
    };

    function getProp(prop) {
        // getter for sync props

        if (Properties.localStorageProps.includes(prop)) {
            return Config[prop];
        }
        if (Properties.orgProps.includes(prop)) {
            return getMetaProp(prop);
        }
        if (Properties.keys.includes(prop)) {
            return Keys[prop];
        }
        return null;
    };

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
	    window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
    };

    function setStat(statName, statValue) {
        // eg sessionStartTime
        Config['BTStats'][statName] = statValue;
	    window.postMessage({'function': 'localStore', 'data': {'Config': Config}});
    };  
    
    function updatePrefs() {
        // update preferences based on data read into AllNodes.metaProperties

        let groupMode = configManager.getProp('BTGroupingMode');
        if (groupMode) {
            const $radio = $('#tabGroupToggle :radio[name=grouping]');

            // v099 move away from have a WINDOW default, new window now a choice on opening
            if (groupMode == 'WINDOW') {
                groupMode = 'TABGROUP';
                configManager.setProp('BTGroupingMode', groupMode);
            }            
            
            $radio.filter(`[value=${groupMode}]`).prop('checked', true);
            GroupingMode = groupMode;
	    }

        // does the topic manager live in a tab or a window?
        const managerHome = configManager.getProp('BTManagerHome');
        let $radio;
        if (managerHome) {
            $radio = $('#panelToggle :radio[name=location]');
            $radio.filter(`[value=${managerHome}]`).prop('checked', true);
            window.postMessage({'function': 'localStore', 'data': {'ManagerHome': managerHome}});
        }

        // do we load Favicons? Read value, set ui and re-save in case defaulted
        const favSet = configManager.getProp('BTFavicons');
        const favicons = favSet || 'OFF';
        $radio = $('#faviconToggle :radio[name=favicon]');
        $radio.filter(`[value=${favicons}]`).prop('checked', true);
        if (!favSet) configManager.setProp('BTFavicons', favicons);

        // NONOTES?
        const notes = configManager.getProp('BTNotes') || 'NOTES';
        $radio = $('#notesToggle :radio[name=notes]');
        $radio.filter(`[value=${notes}]`).prop('checked', true);
        checkCompactMode((notes == 'NONOTES'));                         // turn off if needed

        // Dense?
        const dense = configManager.getProp('BTDense') || 'NOTDENSE';
        $radio = $('#denseToggle :radio[name=dense]');
        $radio.filter(`[value=${dense}]`).prop('checked', true);
        document.documentElement.setAttribute('data-dense', dense);

        // Large?
        const large = configManager.getProp('BTSize') || 'NOTLARGE';
        $radio = $('#largeToggle :radio[name=large]');
        $radio.filter(`[value=${large}]`).prop('checked', true);
        document.documentElement.setAttribute('data-size', large);
        
        // Theme saved or set from OS
        const themeSet = configManager.getProp('BTTheme');
        const theme = themeSet ||
              (window?.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT');
        $radio = $('#themeToggle :radio[name=theme]');
        $radio.filter(`[value=${theme}]`).prop('checked', true);
        if (!themeSet) configManager.setProp('BTTheme', theme);
        // Change theme by setting attr on document which overides a set of vars. see top of bt.css
        document.documentElement.setAttribute('data-theme', theme);
        $('#topBar img').removeClass(['LIGHT', 'DARK']).addClass(theme);  // swap some icons
        $('#footer img').removeClass(['LIGHT', 'DARK']).addClass(theme);
    }

    // Register listener for radio button changes in Options
    $(document).ready(function () {
        $('#tabGroupToggle :radio').change(function () {
            const oldVal = GroupingMode;
            const newVal = $(this).val();
            GroupingMode = newVal;
            configManager.setProp('BTGroupingMode', GroupingMode);
            saveBT();
            groupingUpdate(oldVal, newVal);
        });
        $('#panelToggle :radio').change(function () {
            const newHome = $(this).val();
            configManager.setProp('BTManagerHome', newHome);
            // Let extension know
            window.postMessage({'function': 'localStore', 'data': {'ManagerHome': newHome}});
            saveBT();
        });
        $('#notesToggle :radio').change(function () {
            const newN = $(this).val();
            configManager.setProp('BTNotes', newN);
            // do it
            checkCompactMode((newN == 'NONOTES'));
            saveBT();
        });
        $('#denseToggle :radio').change(function () {
            const newD = $(this).val();
            configManager.setProp('BTDense', newD);
            // do it
            document.documentElement.setAttribute('data-dense', newD);
            saveBT();
        });
        $('#largeToggle :radio').change(function () {
            const newL = $(this).val();
            configManager.setProp('BTSize', newL);
            // do it
            document.documentElement.setAttribute('data-size', newL);
            saveBT();
        });
        $('#faviconToggle :radio').change(function () {
            const favicons = $(this).val();
            const favClass = (favicons == 'ON') ? 'faviconOn' : 'faviconOff';
            configManager.setProp('BTFavicons', favicons);
            // Turn on or off
            $('#content img').removeClass('faviconOff', 'faviconOn').addClass(favClass);
            saveBT();
        });
        $('#themeToggle :radio').change(function () {
            const newTheme = $(this).val();
            configManager.setProp('BTTheme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(newTheme);
            $('#footer img').removeClass(['DARK', 'LIGHT']).addClass(newTheme);
            // Let extension know
            window.postMessage({'function': 'localStore', 'data': {'Theme': newTheme}});
            saveBT();
        });
        $('#syncSetting :radio').change(async function () {
            const newVal = $(this).val();
            let success = false;
            if (newVal == 'gdrive')
                success = await authorizeGAPI(true);
            if (newVal == 'local')
                success = await authorizeLocalFile();
            if (success) {
                $("#settingsSync").hide();
                $("#settingsSyncStatus").show();
                $("#syncType").text((newVal == 'gdrive') ? "GDrive" : "Local File");
                $("#actionsSyncStatus").show();
            }
            return success;
        });
    });

    function toggleSettingsDisplay() {
        // open/close settings panel
        
        const iconColor = (getProp('BTTheme') == 'LIGHT') ? 'LIGHT' : 'DARK';
        
        if ($('#actions').is(':visible'))
            toggleActionsDisplay();                       // can't have both open
        
        if ($('#settings').is(':visible')) {            
            $('#settings').slideUp({duration: 250, 'easing': 'easeInCirc'});
            $("body").css("overflow", "auto");
            setTimeout(() => {
                $('#settingsButton').removeClass('open');
                $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(iconColor);
            }, 250);
        } else {
            $('#settings').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#settingsButton').addClass('open');
            $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass('DARK');
            $("body").css("overflow", "hidden");          // don't allow table to be scrolled
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
            $("body").css("overflow", "auto");
            setTimeout(() => {
                $('#actionsButton').removeClass('open');
                $('#topBar img').removeClass(['DARK', 'LIGHT']).addClass(iconColor);
            }, 250);
        } else {
            $('#actions').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#actionsButton').addClass('open');
            $('#topBar img').removeClass(['LIGHT', 'DARK']).addClass('DARK');
            $("body").css("overflow", "hidden");          // don't allow table to be scrolled
        }
    }

    function toggleHelpDisplay(panel) {
        // open/close help panel
        
        const iconColor = (getProp('BTTheme') == 'LIGHT') ? 'LIGHT' : 'DARK';
        if ($('#help').is(':visible')) {
            // now visible => action is close
            $('#help').slideUp({duration: 250, 'easing': 'easeInCirc'});
            $("body").css("overflow", "auto");
            setTimeout(() => {
                $('#footerHelp').removeClass('open');
                $('#footer img').removeClass(['LIGHT', 'DARK']).addClass(iconColor);
            }, 250);
        } else {
            // now visible => action is open
            $('#help').slideDown({duration: 250, 'easing': 'easeInCirc'});
            $('#footerHelp').addClass('open');
            $('#footer img').removeClass(['LIGHT', 'DARK']).addClass('DARK');
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
        if (getProp('BTLastBookmarkImport')) {
            const datestr = getProp('BTLastBookmarkImport').replace(';', ':');
            const date = Date.parse(datestr);
            if (date) {
                setStat('BTInstallDate', date);
                return;
            }
        }
        const saveDays = Math.min(Config['BTStats']['BTNumSaves'] / 2, 365);
        const guessedInstallDate = Date.now() - (saveDays * 24 * 60 * 60000);
        setStat('BTInstallDate', guessedInstallDate);
    }

    return {
        setConfigAndKeys: setConfigAndKeys,
        setProp: setProp,
        getProp: getProp,
        setStat: setStat,
        incrementStat: incrementStat,
        updatePrefs: updatePrefs,
        toggleSettingsDisplay: toggleSettingsDisplay,
        toggleHelpDisplay: toggleHelpDisplay,
        toggleActionsDisplay: toggleActionsDisplay,
        closeConfigDisplays: closeConfigDisplays,
        toggleKeyCommands: toggleKeyCommands,
        initializeInstallDate: initializeInstallDate
    };
})();

    
