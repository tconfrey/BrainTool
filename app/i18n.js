/**
 * Copyright (c) 2019-2025 Tony Confrey, DataFoundries LLC
 * i18n additions © Nikitamce contributors
 *
 * Shared internationalization for the BrainTool Topic Manager (web app).
 * Language: browser UI language, overridable via Settings (BTLocale).
 */

'use strict';

import { getProp, setProp } from './configManager.js';

const SUPPORTED = ['en', 'ru'];

const catalogs = {
    en: {
        // Meta
        appTitle: 'BrainTool Topic Manager',
        loadingMessage: 'Loading your BrainTool file<br/>...',
        yes: 'Yes',
        no: 'No',
        ok: 'OK',
        cancel: 'Cancel',
        close: 'Close',
        update: 'Update',
        next: 'Next',
        previous: 'Previous',
        help: 'Help',
        settings: 'Settings',
        actions: 'Actions',
        version: 'Version: {v}',

        // Controls header
        exitSearch: 'Exit Search',
        searchHint: "Click here or 's' to search",
        searchAria: 'Search',
        filterTodos: 'Filter TODOs',
        filterMatches: 'Filter Matches',
        previousMatch: 'Previous Match',
        nextMatch: 'Next Match',
        addTopLevelTopic: '+ ADD A NEW TOP LEVEL TOPIC',
        trialExpiredHeading: 'YOUR 30 DAY NAG-FREE TRIAL HAS EXPIRED',
        trialExpiredText: "Hello there! <br/>It looks like your 30 trial has expired and you haven't signed up as a Supporter. Please consider doing so to support the creation and ongoing evolution of BrainTool.<br/> <a href=\"#\" id=\"trialWarningLink\">Go to Settings for Supporter options.</a>",

        // Settings
        settingsTitle: 'BrainTool Settings',
        supporterZone: 'Supporter<br/>Zone',
        topicManagerLocation: 'Topic Manager Location:',
        locationWindow: 'Window',
        locationSidePanel: 'Side panel',
        locationTab: 'Tab',
        locationFootnote: '* Applies next time the Topic Manager is opened.',
        syncTo: 'Sync To:',
        syncGDrive: 'Google Drive file',
        syncLocal: 'Local file',
        syncNone: 'No sync',
        syncPermissionFootnote: '* You will need to grant appropriate permissions',
        syncEnabled: '{type} Sync Enabled',
        syncDisableFootnote: 'Disable current syncing (under Actions) to change this setting',
        keepBackups: 'Keep Backups (Saves recent, daily and monthly backups)',
        sessionManager: 'Session Manager?',
        darkMode: 'Dark Mode?',
        showFavicons: 'Show Favicons?',
        compact: 'Compact?',
        largeFont: 'Large Font?',
        showTooltips: 'Show Tooltips?',
        useTabgroups: 'Use Tabgroups?',
        language: 'Interface language:',
        languageAuto: 'Browser default',
        languageEn: 'English',
        languageRu: 'Русский',
        languageFootnote: '* Applies after reload of the Topic Manager.',
        supporterStatus: 'Supporter Status:',
        freeUserText: 'You are using BrainTool for free.<br/>Please consider supporting BrainTool with a purchase. Thank you!',
        planMonth: 'Month $1.33',
        planYear: 'Year $10.66',
        planLifetime: 'Lifetime $20.99',
        couponsNote: 'Coupons applied at checkout',
        offersLink: 'Click here for current offers and all benefits information.',
        importKey: 'Click here to manually enter a license code.',
        subActive: 'You have a valid BrainTool subscription (ID = <span class="subId"></span>) <br/> Renews on <span id="renewDate"></span><br>Thank you for your support!',
        otpActive: 'You have a permanent BrainTool license (ID = <span class="subId"></span>) <br/> Thank you for your support!',
        manageSubscription: 'Manage your subscription',
        gdrive: 'GDrive',
        localFile: 'Local File',

        // Actions
        actionsTitle: 'BrainTool Actions',
        importExport: 'Import/Export:',
        importColon: 'Import:',
        exportTo: 'Export To:',
        browserBookmarks: 'Browser Bookmarks',
        orgModeFile: 'An Org-mode file',
        tabsOutlinerExport: 'A TabsOutliner export',
        localOrgFile: 'Local Org-mode file',
        refreshFromFile: 'Refresh from File',
        stopSyncing: 'Stop Syncing',
        syncIsOn: '{type} sync is on.',
        fileLabel: 'File: {path}',
        folderLabel: 'Folder: {name}',

        // Help
        helpTitle: 'Help and Support',
        helpUserGuide: 'User Guide and General Help',
        helpKeys: "Keyboard Commands (or just press 'h' or '?')",
        helpFAQ: 'FAQs and How-tos',
        helpWebsite: 'BrainTool Website',
        keyNav: 'Nav',
        keyBrowse: 'Browse',
        keyEdit: 'Edit',
        keySearch: 'Search/Reverse-search (next/prev match)',
        keyNavRows: 'Navigate to Next, Previous row',
        keyHierarchy: 'Navigate up/down hierarchy',
        keyLevels: 'Show tree nodes up to level N',
        keyTab: 'Subtree cycle expand one level/all-levels/collapse',
        keySpace: 'Show/open item (in a new window)',
        keyEnter: 'Open/Close in the browser',
        keyUndo: 'Undo last deletion',
        keyMove: 'Move selection up/down',
        keyPromote: 'Promote selection up a level',
        keyTodoEdit: 't cycle TODO state, e Edit',
        keyDelete: 'Delete selection',
        keyNewSubtopic: 'Create a new sub Topic',
        keySidePanel: 'Open BT SidePanel (this window)',
        keyCopy: 'Copy selection and children to clipboard',
        keyOptionNote: 'NB Option is a modifier key like shift or control. It is also called Alt.',
        optionKey: 'Option',
        altKey: 'Alt',

        // Footer
        lastSaved: 'Last saved',
        lastSavedAt: 'Last saved {time}',
        topicsPages: '{topics} Topics, {pages} pages',
        openCount: '({n} open)',
        openParen: '(open)',

        // Edit dialog
        nameTheTopic: 'Name the Topic',
        topicAria: 'Topic',
        titleAria: 'Title',
        urlAria: 'URL',
        noteAria: 'Note',
        permissionsLocal: 'BrainTool needs to re-establish local file access.<br/>The browser will now ask for your permission.',

        // Row tools
        deleteItem: 'Delete item (del)',
        emptyTrash: 'Empty Trash',
        closeSessionView: 'Close session view',
        todoStar: 'ToDo (t)',
        dragMove: 'Drag to move (m-↑↓)',
        promoteUp: 'Promote up hierarchy',
        addChildTopic: 'Add child topic (m-enter)',
        editItem: 'Edit item (e)',
        openNewWindow: 'Open in new window (w)',
        openShow: 'Open/show in browser (space)',
        closeBrowser: 'Close in browser (enter)',
        moreTools: 'More tools',
        fewerTools: 'Fewer tools',

        // Messages / tips chrome
        tipOfDay: 'Tip of the day:',
        tip: 'Tip:',
        warning: 'Warning!',
        message: 'Message',
        welcomeTitle: 'Welcome to BrainTool',
        slideOf: 'Slide {n} of 6',
        importBookmarks: 'Import Bookmarks',
        importSession: 'Import browser session',
        justGetStarted: 'Just get started',
        dontShowSlideshow: "Don't show me this slideshow again",

        // Intro slides
        intro1: '<p>This window is the <b>Topic Manager</b>.</p><p>It allows you to open and close tabs, tab groups, and browser windows, organize them into nested <b>Topics</b> and find them again when you need them.</p><img class="introImage" src="resources/slide1.png"/>',
        intro2: '<p>The BrainTool <b>Bookmarker</b> tool lives in the browser bar.</p><p>It allows you to save the current tab, tab group, window or session under a named <b>Topic</b>, along with an optional note.</p><p>Pin it for easy access.</p><img class="introImage" src="resources/slide2.png"/>',
        intro3: '<p>Use BrainTool to organize all the tabs you want to save and come back to. Hover over a row for tools to open and close groups of tabs, add notes and todo\'s or edit the topic hierarchy.</p><img class="introImage" src="resources/slide3.png"/>',
        intro4: '<p>Everything is kept in plain text in a private local file that you own and can edit, or under your personal Google Drive account for cloud access.</p><img class="introImage" src="resources/slide4.png"/>',
        intro5: '<p>See Search, Settings and Actions in the Header and Help below. Watch for Messages, Warnings and Tips on startup.</p><img class="introImage" src="resources/slide5.png"/>',
        intro6: '<p>Those are the basics. See the Help section and linked manuals and tutorial videos for more.</p><p>Now lets get started organizing your online life!</p><p>We\'ve set you up with a sample <b>Topic</b> hierarchy. You might want to also pull in your bookmarks or save your current session (either one can be done later).</p>',

        // Tips
        tip0: "Add ':' at the end of a topic in the Bookmarker to create a new subtopic.",
        tip1: "Double click on a table row to go to it's tab or tabgroup, if it's open.",
        tip2: "Type ':TODO' after a topic in the Bookmarker to make the item a TODO in the BT tree.",
        tip3: 'Create topics like ToRead or ToWatch to keep track of pages you want to come back to.',
        tip4: "You'll need to Refresh if you've been editing the BrainTool.org file directly.",
        tip5: '{opt}-b is the BrainTool accelerator key. You can change that in the browsers extension settings',
        tip6: 'Save LinkedIn pages under specific topics to keep track of your contacts in context.',
        tip7: 'Use the TODO (star) button on a row to toggle between TODO, DONE and none.',
        tip8: 'See BrainTool.org for the BrainTool blog and other info.',
        tip9: "Follow <a target='_blank' href='https://twitter.com/ABraintool'>@ABrainTool</a> on X and other socials!",
        tip10: 'Check out the Bookmark import/export functions under Actions',
        tip11: 'You can click on the topics shown in the Bookmarker instead of typing out the name.',
        tip12: 'Use the forward (>>) button on the right to cycle through tips',
        tip13: 'Double tap {opt}-b, or double click the toolbar icon, to surface the Topic Manager.',
        tip14: 'When you have an Edit card open, the {opt}-up/down arrows will open the next/previous card.',
        tip15: "Click on a row to select it then use keyboard commands. 'h' for a list of them.",
        tip16: "You can also store local files and folders in BrainTool. <br/>Enter something like 'file:///users/tconfrey/Documents/' in the browser address bar.",
        tip17: "Try hitting '1','2','3' etc to collapse the tree to that level.",
        tip18: 'Import public topic trees and useful links from braintool.org/topicTrees.',
        tip19: "Try the DARK theme. It's under Settings.",
        tip20: 'Tab cycles a selected topic from collapsed, to showing children, to showing all descendants.',
        tip21: 'The Topic Manager can run inside the browser window in a side panel. See Settings.',
        tip22: "Check out ToDo and search results filtering! Click the ⭐️ or <img src='resources/filter.svg' style='height:20px;vertical-align:middle'> button in Search.",
        tip23: 'You can drag a tab from the URL bar and drop onto the Topic Manager to add a page to a given topic.',
        tip24: "<span class='emoji'>&#128512;</span> You can use emojis to <span class='emoji'>&#127774;</span> brighten up your topic names. <span class='emoji'>&#128079; &#128736;</span>",

        // Startup messages
        msg0: "Welcome to the BrainTool 1.3!<br/>See the <a target='_blank' href='https://braintool.org/support/releaseNotes.html'>release notes</a> for a list of changes.",
        msg1: 'You can now drag links from inside web pages and drop them onto the Topic Manager to add them to a topic.',
        msg2: "There's a new 'Special' Bookmarks Bar Topic synced to the contents of your browser's Bookmarks Bar. Just delete it to remove.",
        msg3: "There's a new Trash 'special' topic to hold deleted nodes until emptied.",
        msg4: "Check out the updated <a target='_blank' href='https://braintool.org'>BrainTool.org</a> and the added <a target='_blank' href='https://braintool.org/support/userGuide.html'>User Guide</a> material!",

        // Alerts / confirms (common)
        confirmStaleFile: 'The synced version of your BrainTool file has newer data. \n\nClick OK the refresh from it, or Cancel to overwrite with this change.',
        alertLocalSyncOn: 'Local file sync established. See Actions to disable.',
        alertNoFile: 'No file connected',
        alertSyncDisabled: 'Sync has been disabled. See Settings to re-enable.',
        alertBackupsNeedLocal: 'Local File syncing is required to create backups',
        alertBackupsOff: 'Backups are off',
        alertErrorLoading: 'Error loading Topic file',
        alertBookmarkPerm: 'Bookmark permissions denied',
        confirmReaddTopic: 'Re-add this topic tree?',
        confirmUngroup: 'Also ungroup open tabs?',
        alertReservedWord: '{title} is a reserved word in org-mode, using {alt} instead',
        alertConflictSub: "Conflicting subscription id's found! This should not happen. I'm using the local value, if there are issues contact BrainTool support.\nLocal value:{local}\nOrg file value:{file}",
        alertPurchaseSidepanel: "Unfortunately purchasing is not currently supported in the side panel. \n\nPlease set the Topic Manager Location to Window or Tab to make a purchase.",
        alertFirebaseFail: 'Sorry Firebase initialization failed.',
        alertStripeFail: 'Sorry Stripe/Firebase initialization failed.',
        confirmStripe: "You will now be forwarded to Stripe to confirm payment details to Data Foundries LLC (BrainTool's incorporated name).\n\nAfter that BT will reload with your supporter status in place.\n\nNB coupons can be applied at purchase.\nForwarding might take several seconds.",
        alertFirebaseUserFail: 'Sorry Firebase user creation failed.',
        alertAlreadySubscription: 'Seems like you already have a subscription associated with this browser. Close and restart BrainTool.',
        alertAlreadyLicense: 'Seems like you already have a license associated with this browser. Close and restart BrainTool.',
        alertBtIdNotSet: 'BrainTool Id not set!',
        alertOpeningStripePortal: 'Opening Stripe portal to manage your subscription. This may take a few seconds.',
        alertPurchaseCancelled: 'Your purchase was cancelled. No changes were made.',
        alertPermanentLicense: 'You now have a permanent license. Thank you for supporting BrainTool!',
        alertSubscriptionActive: 'Your subscription is now active. Thank you for supporting BrainTool!',
        alertSubscriptionExpired: 'Looks like your subscription has expired. Create a new subscription or continue using the free version.',
        alertGenericError: 'An error occurred: {msg}',
        alertStripePortalError: 'Error accessing Stripe portal:\n{err}',
        promptLicenseKey: 'Please enter your license key:',
        alertLicenseAccepted: 'License key accepted. Thank you for supporting BrainTool!',
        alertGdriveToken: 'BT - Security token expired. Renew the token and try again?',
        alertGdriveLocalSave: 'Changes saved locally. GDrive connection failed. Google says:\n{err}',
        alertGdriveSidepanel: 'GDrive saving cannot be initiated from Sidepanel view. \n\nPlease set the Topic Manager Location to Window or Tab to perform this action.',
        alertGdriveAuth: '- Passing you to Google to grant permissions. \n- Allow cookies and popups from both braintool.org and accounts.google.com in browser settings.\n- Complete all steps to allow file access, see braintool.org/support for details.',
        alertGdriveAuthTimeout: 'Google Authentication should have completed by now.\nIt may have failed due to extensions such as Privacy Badger or if 3rd party cookies are disallowed. Exempt braintool.org and accounts.google.com from blockers and allow cookies and popups from those urls. If problems continues see \nbraintool.org/support',
        alertGdriveParse: 'Error parsing BrainTool.org file from GDrive:\n{err}',
        alertGdriveCreate: 'Error creating BT file on GDrive: [{err}]',
        alertGdriveNoId: 'Something went wrong. BTFileID not set. Try restarting BrainTool',
        alertGdriveNoIdSave: 'BTFileID not set, not saving to GDrive',
        confirmGdriveOverwrite: "There's a newer BrainTool.org file on GDrive. Overwrite it?\nNB changes have been made locally either way.",
        alertGdriveSaveErr: 'BT - Error saving to GDrive.',
        alertLocalUnsupported: "Sorry, local file saving is not supported on your browser (NB Brave has a flag to enable, open brave://flags and toggle 'File System Access API')",
        alertLocalSidepanel: 'Local file saving cannot be initiated from Sidepanel view. \n\nPlease set the Topic Manager Location to Window or Tab to perform this action.',
        alertLocalChoose: 'Choose where you want to store your BrainTool file',
        alertLocalCancel: 'Cancelling Local File sync',
        alertLocalAccess: 'Error accessing local file, cancelling sync',
        confirmLocalUseExisting: 'BrainTool.org file already exists. Click OK to use its contents',
        alertLocalPerm: 'Error requesting file permission: {err}',
        confirmLocalNewer: 'Synced BrainTool.org file on disk is newer than browser data. \nHit Cancel to ignore or OK to load newer. \nUse newer?',
        alertLocalParse: 'Error parsing BrainTool.org file from local file:\n{err}',
        alertBackupFolderErr: 'Error creating BT-Backups folder',
        alertBackupStored: 'Backups will be stored in "{backup}" under "{parent}"',
        alertBackupAccess: 'Error accessing BT-Backups folder',
        exportBookmarksTitle: 'BrainTool Export {date}',
        alertParseOrg: 'Error in parsing BrainTool.org file:\n{err}',
        alertSaveInProgress: 'A save is currently in process, please wait a few seconds and try again',
        alertProcessFileFail: 'Could not process BT file. Please check it for errors and restart',
        confirmOpenTabs: 'Open {n} tabs?',
        confirmDeleteSubtree: 'Delete whole subtree?',
        warnStaleFileClick: 'The synced version of your BrainTool file has newer data. <br/>Click here to refresh or disregard and it will be overwritten on the next save.',
        warnGdriveAuthExpired: "GDrive authorization has expired. <br/>Click here to refresh now, otherwise I'll try when there's something to save.",
        warnLocalFileAccess: 'Error accessing the synced BrainTool file{detail}',
        warnLocalFileAccessDetail: ':<br/><small>"{msg}"</small>',
        confirmGdriveExists: "A BrainTool.org file already exists. It was last modified {date}. 'OK' to use its contents, 'Cancel' to overwrite with local data.",
        confirmGdriveNewer: "Synced BrainTool.org file on GDrive is newer than browser data. \nHit Cancel to ignore or OK to load newer. \nUse newer?",
        alertGdriveListError: 'BT - error reading file list from GDrive. Check permissions and retry',
        alertGdriveListErrorGoogle: 'BT - error reading file list from GDrive. Check permissions and retry\nGoogle says: {msg}',
        bookmarkImportName: '🔖 Bookmark Import ({date})',
        expandCollapse: 'Expand/Collapse',
    },

    ru: {
        // Keep English for chrome.tabs.query({title}) matching in the extension
        appTitle: 'BrainTool Topic Manager',
        loadingMessage: 'Загрузка файла BrainTool<br/>...',
        yes: 'Да',
        no: 'Нет',
        ok: 'OK',
        cancel: 'Отмена',
        close: 'Закрыть',
        update: 'Сохранить',
        next: 'Далее',
        previous: 'Назад',
        help: 'Справка',
        settings: 'Настройки',
        actions: 'Действия',
        version: 'Версия: {v}',

        exitSearch: 'Выйти из поиска',
        searchHint: "Нажмите сюда или клавишу «s» для поиска",
        searchAria: 'Поиск',
        filterTodos: 'Фильтр TODO',
        filterMatches: 'Фильтр совпадений',
        previousMatch: 'Предыдущее совпадение',
        nextMatch: 'Следующее совпадение',
        addTopLevelTopic: '+ ДОБАВИТЬ ТЕМУ ВЕРХНЕГО УРОВНЯ',
        trialExpiredHeading: 'ВАШ 30-ДНЕВНЫЙ ПРОБНЫЙ ПЕРИОД БЕЗ НАПОМИНАНИЙ ИСТЁК',
        trialExpiredText: 'Здравствуйте! <br/>Похоже, 30-дневный пробный период закончился, и вы ещё не оформили поддержку. Пожалуйста, рассмотрите возможность стать спонсором — это помогает развивать BrainTool.<br/> <a href=\"#\" id=\"trialWarningLink\">Откройте Настройки, чтобы увидеть варианты поддержки.</a>',

        settingsTitle: 'Настройки BrainTool',
        supporterZone: 'Зона<br/>спонсоров',
        topicManagerLocation: 'Расположение менеджера тем:',
        locationWindow: 'Окно',
        locationSidePanel: 'Боковая панель',
        locationTab: 'Вкладка',
        locationFootnote: '* Применится при следующем открытии менеджера тем.',
        syncTo: 'Синхронизация с:',
        syncGDrive: 'Файл Google Drive',
        syncLocal: 'Локальный файл',
        syncNone: 'Без синхронизации',
        syncPermissionFootnote: '* Потребуется выдать соответствующие разрешения',
        syncEnabled: 'Синхронизация {type} включена',
        syncDisableFootnote: 'Чтобы изменить, отключите текущую синхронизацию (в разделе «Действия»)',
        keepBackups: 'Хранить резервные копии (недавние, ежедневные и ежемесячные)',
        sessionManager: 'Менеджер сеанса?',
        darkMode: 'Тёмная тема?',
        showFavicons: 'Показывать иконки сайтов?',
        compact: 'Компактный вид?',
        largeFont: 'Крупный шрифт?',
        showTooltips: 'Показывать подсказки?',
        useTabgroups: 'Использовать группы вкладок?',
        language: 'Язык интерфейса:',
        languageAuto: 'Как в браузере',
        languageEn: 'English',
        languageRu: 'Русский',
        languageFootnote: '* Применится после перезагрузки менеджера тем.',
        supporterStatus: 'Статус поддержки:',
        freeUserText: 'Вы пользуетесь BrainTool бесплатно.<br/>Пожалуйста, рассмотрите возможность поддержать проект покупкой. Спасибо!',
        planMonth: 'Месяц $1.33',
        planYear: 'Год $10.66',
        planLifetime: 'Навсегда $20.99',
        couponsNote: 'Купоны применяются при оплате',
        offersLink: 'Актуальные предложения и список преимуществ.',
        importKey: 'Ввести лицензионный ключ вручную.',
        subActive: 'У вас активна подписка BrainTool (ID = <span class="subId"></span>) <br/> Продление: <span id="renewDate"></span><br>Спасибо за поддержку!',
        otpActive: 'У вас бессрочная лицензия BrainTool (ID = <span class="subId"></span>) <br/> Спасибо за поддержку!',
        manageSubscription: 'Управление подпиской',
        gdrive: 'GDrive',
        localFile: 'Локальный файл',

        actionsTitle: 'Действия BrainTool',
        importExport: 'Импорт/экспорт:',
        importColon: 'Импорт:',
        exportTo: 'Экспорт в:',
        browserBookmarks: 'Закладки браузера',
        orgModeFile: 'Файл Org-mode',
        tabsOutlinerExport: 'Экспорт TabsOutliner',
        localOrgFile: 'Локальный файл Org-mode',
        refreshFromFile: 'Обновить из файла',
        stopSyncing: 'Отключить синхронизацию',
        syncIsOn: 'Синхронизация {type} включена.',
        fileLabel: 'Файл: {path}',
        folderLabel: 'Папка: {name}',

        helpTitle: 'Справка и поддержка',
        helpUserGuide: 'Руководство пользователя и общая справка',
        helpKeys: "Клавиатурные команды (или клавиши «h» / «?»)",
        helpFAQ: 'FAQ и инструкции',
        helpWebsite: 'Сайт BrainTool',
        keyNav: 'Нав.',
        keyBrowse: 'Обзор',
        keyEdit: 'Правка',
        keySearch: 'Поиск / обратный поиск (след./пред. совпадение)',
        keyNavRows: 'К следующей / предыдущей строке',
        keyHierarchy: 'Вверх / вниз по иерархии',
        keyLevels: 'Показать дерево до уровня N',
        keyTab: 'Цикл: развернуть на уровень / все / свернуть',
        keySpace: 'Показать / открыть элемент (в новом окне)',
        keyEnter: 'Открыть / закрыть во вкладке браузера',
        keyUndo: 'Отменить последнее удаление',
        keyMove: 'Переместить выделение вверх / вниз',
        keyPromote: 'Поднять выделение на уровень выше',
        keyTodoEdit: 't — цикл TODO, e — правка',
        keyDelete: 'Удалить выделение',
        keyNewSubtopic: 'Создать подтему',
        keySidePanel: 'Открыть боковую панель BT',
        keyCopy: 'Копировать выделение и потомков в буфер',
        keyOptionNote: 'NB: Option — модификатор (как Shift или Control). Также называется Alt.',
        optionKey: 'Option',
        altKey: 'Alt',

        lastSaved: 'Сохранено',
        lastSavedAt: 'Сохранено {time}',
        topicsPages: '{topics} тем, {pages} страниц',
        openCount: '({n} открыто)',
        openParen: '(открыто)',

        nameTheTopic: 'Название темы',
        topicAria: 'Тема',
        titleAria: 'Заголовок',
        urlAria: 'URL',
        noteAria: 'Заметка',
        permissionsLocal: 'BrainTool нужно снова получить доступ к локальному файлу.<br/>Браузер сейчас запросит разрешение.',

        deleteItem: 'Удалить (Del)',
        emptyTrash: 'Очистить корзину',
        closeSessionView: 'Закрыть вид сеанса',
        todoStar: 'TODO (t)',
        dragMove: 'Перетащить (m-↑↓)',
        promoteUp: 'Поднять в иерархии',
        addChildTopic: 'Добавить подтему (m-Enter)',
        editItem: 'Редактировать (e)',
        openNewWindow: 'Открыть в новом окне (w)',
        openShow: 'Открыть / показать (пробел)',
        closeBrowser: 'Закрыть во вкладке (Enter)',
        moreTools: 'Ещё инструменты',
        fewerTools: 'Меньше инструментов',

        tipOfDay: 'Совет дня:',
        tip: 'Совет:',
        warning: 'Внимание!',
        message: 'Сообщение',
        welcomeTitle: 'Добро пожаловать в BrainTool',
        slideOf: 'Слайд {n} из 6',
        importBookmarks: 'Импорт закладок',
        importSession: 'Импорт сеанса браузера',
        justGetStarted: 'Просто начать',
        dontShowSlideshow: 'Больше не показывать это введение',

        intro1: '<p>Это окно — <b>менеджер тем</b>.</p><p>В нём можно открывать и закрывать вкладки, группы вкладок и окна, раскладывать их по вложенным <b>темам</b> и быстро находить нужное.</p><img class="introImage" src="resources/slide1.png"/>',
        intro2: '<p>Инструмент <b>Bookmarker</b> живёт на панели браузера.</p><p>Он сохраняет текущую вкладку, группу, окно или сеанс в именованную <b>тему</b> с необязательной заметкой.</p><p>Закрепите его для быстрого доступа.</p><img class="introImage" src="resources/slide2.png"/>',
        intro3: '<p>Собирайте вкладки, к которым хотите вернуться. Наведите курсор на строку — появятся инструменты открытия/закрытия, заметок, TODO и правки иерархии.</p><img class="introImage" src="resources/slide3.png"/>',
        intro4: '<p>Всё хранится в обычном тексте: в вашем локальном файле, который вы контролируете, или в личном Google Drive для доступа из облака.</p><img class="introImage" src="resources/slide4.png"/>',
        intro5: '<p>Поиск, настройки и действия — в шапке, справка — внизу. При запуске смотрите сообщения, предупреждения и советы.</p><img class="introImage" src="resources/slide5.png"/>',
        intro6: '<p>Это основы. Подробности — в справке, руководствах и видео.</p><p>Пора навести порядок в онлайн-жизни!</p><p>Мы подготовили пример иерархии <b>тем</b>. Можно также импортировать закладки или сохранить текущий сеанс (это можно сделать и позже).</p>',

        tip0: "Добавьте «:» в конце темы в Bookmarker, чтобы создать подтему.",
        tip1: 'Двойной щелчок по строке перейдёт к её вкладке или группе, если они открыты.',
        tip2: "Введите «:TODO» после темы в Bookmarker, чтобы пометить элемент как TODO.",
        tip3: 'Создавайте темы вроде ToRead или ToWatch для страниц, к которым хотите вернуться.',
        tip4: 'Если правили BrainTool.org вручную — нажмите «Обновить из файла».',
        tip5: '{opt}-b — горячая клавиша BrainTool. Её можно сменить в настройках расширений браузера',
        tip6: 'Сохраняйте страницы LinkedIn в тематических папках, чтобы видеть контакты в контексте.',
        tip7: 'Кнопка TODO (звезда) переключает TODO → DONE → без метки.',
        tip8: 'На BrainTool.org — блог и другая информация о проекте.',
        tip9: "Подписывайтесь на <a target='_blank' href='https://twitter.com/ABraintool'>@ABrainTool</a> в X и других соцсетях!",
        tip10: 'Импорт и экспорт закладок — в разделе «Действия»',
        tip11: 'В Bookmarker можно кликать по темам из списка, а не только вводить имя.',
        tip12: 'Кнопка «вперёд» (>>) справа листает советы',
        tip13: 'Двойное нажатие {opt}-b или двойной щелчок по иконке открывает менеджер тем.',
        tip14: 'При открытой карточке правки стрелки {opt}-↑/↓ открывают соседние карточки.',
        tip15: "Выделите строку и пользуйтесь клавишами. «h» — список команд.",
        tip16: "В BrainTool можно хранить локальные файлы и папки. <br/>Введите, например, «file:///users/tconfrey/Documents/» в адресной строке.",
        tip17: "Клавиши «1», «2», «3»… сворачивают дерево до этого уровня.",
        tip18: 'Публичные деревья тем — на braintool.org/topicTrees.',
        tip19: 'Попробуйте тёмную тему в «Настройках».',
        tip20: 'Tab на выделенной теме: свёрнуто → дети → все потомки.',
        tip21: 'Менеджер тем может жить в боковой панели браузера. См. «Настройки».',
        tip22: "Фильтры TODO и результатов поиска: ⭐️ или <img src='resources/filter.svg' style='height:20px;vertical-align:middle'> в поиске.",
        tip23: 'Можно перетащить вкладку из адресной строки на менеджер тем.',
        tip24: "<span class='emoji'>&#128512;</span> В названиях тем можно использовать эмодзи <span class='emoji'>&#127774;</span> <span class='emoji'>&#128079; &#128736;</span>",

        msg0: "Добро пожаловать в BrainTool 1.3!<br/>Список изменений — в <a target='_blank' href='https://braintool.org/support/releaseNotes.html'>заметках о выпуске</a>.",
        msg1: 'Ссылки со страниц можно перетаскивать прямо в менеджер тем.',
        msg2: "Появилась особая тема «Bookmarks Bar», синхронизируемая с панелью закладок браузера. Удалите её, если не нужна.",
        msg3: "Появилась особая тема «Trash» для удалённых узлов, пока корзину не очистят.",
        msg4: "Загляните на обновлённый <a target='_blank' href='https://braintool.org'>BrainTool.org</a> и в <a target='_blank' href='https://braintool.org/support/userGuide.html'>руководство пользователя</a>!",

        confirmStaleFile: 'В синхронизированном файле BrainTool есть более новые данные.\n\nOK — обновить из файла, Отмена — перезаписать своими изменениями.',
        alertLocalSyncOn: 'Синхронизация с локальным файлом настроена. Отключение — в «Действиях».',
        alertNoFile: 'Файл не подключён',
        alertSyncDisabled: 'Синхронизация отключена. Включить снова — в «Настройках».',
        alertBackupsNeedLocal: 'Для резервных копий нужна синхронизация с локальным файлом',
        alertBackupsOff: 'Резервные копии выключены',
        alertErrorLoading: 'Ошибка загрузки файла тем',
        alertBookmarkPerm: 'Нет разрешения на доступ к закладкам',
        confirmReaddTopic: 'Снова добавить это дерево тем?',
        confirmUngroup: 'Также разгруппировать открытые вкладки?',
        alertReservedWord: '«{title}» — зарезервированное слово org-mode, будет использовано «{alt}»',
        alertConflictSub: 'Обнаружены конфликтующие ID подписки! Используется локальное значение. При проблемах напишите в поддержку BrainTool.\nЛокально: {local}\nВ org-файле: {file}',
        alertPurchaseSidepanel: 'Покупка пока недоступна из боковой панели.\n\nУкажите в настройках расположение менеджера тем «Окно» или «Вкладка».',
        alertFirebaseFail: 'Не удалось инициализировать Firebase.',
        alertStripeFail: 'Не удалось инициализировать Stripe/Firebase.',
        confirmStripe: 'Сейчас вы перейдёте в Stripe для оплаты Data Foundries LLC (юр. лицо BrainTool).\n\nПосле этого BT перезагрузится со статусом спонсора.\n\nКупоны можно применить при оплате.\nПереход может занять несколько секунд.',
        alertFirebaseUserFail: 'Не удалось создать пользователя Firebase.',
        alertAlreadySubscription: 'Похоже, с этим браузером уже связана подписка. Закройте и перезапустите BrainTool.',
        alertAlreadyLicense: 'Похоже, с этим браузером уже связана лицензия. Закройте и перезапустите BrainTool.',
        alertBtIdNotSet: 'Идентификатор BrainTool не задан!',
        alertOpeningStripePortal: 'Открываем портал Stripe для управления подпиской. Это может занять несколько секунд.',
        alertPurchaseCancelled: 'Покупка отменена. Изменений не внесено.',
        alertPermanentLicense: 'У вас теперь бессрочная лицензия. Спасибо за поддержку BrainTool!',
        alertSubscriptionActive: 'Подписка активна. Спасибо за поддержку BrainTool!',
        alertSubscriptionExpired: 'Похоже, срок подписки истёк. Оформите новую подписку или продолжайте пользоваться бесплатной версией.',
        alertGenericError: 'Произошла ошибка: {msg}',
        alertStripePortalError: 'Ошибка доступа к порталу Stripe:\n{err}',
        promptLicenseKey: 'Введите лицензионный ключ:',
        alertLicenseAccepted: 'Лицензионный ключ принят. Спасибо за поддержку BrainTool!',
        alertGdriveToken: 'BT — истёк токен безопасности. Обновить токен и повторить?',
        alertGdriveLocalSave: 'Изменения сохранены локально. Ошибка GDrive. Ответ Google:\n{err}',
        alertGdriveSidepanel: 'Сохранение в GDrive нельзя начать из боковой панели.\n\nУкажите расположение менеджера тем «Окно» или «Вкладка».',
        alertGdriveAuth: '- Сейчас откроется Google для выдачи прав.\n- Разрешите cookies и всплывающие окна для braintool.org и accounts.google.com.\n- Пройдите все шаги доступа к файлу; подробности на braintool.org/support.',
        alertGdriveAuthTimeout: 'Авторизация Google должна была завершиться.\nВозможны блокировки (Privacy Badger и т.п.) или запрет сторонних cookies. Исключите braintool.org и accounts.google.com. Подробнее: braintool.org/support',
        alertGdriveParse: 'Ошибка разбора BrainTool.org с GDrive:\n{err}',
        alertGdriveCreate: 'Ошибка создания файла BT на GDrive: [{err}]',
        alertGdriveNoId: 'Что-то пошло не так: BTFileID не задан. Перезапустите BrainTool',
        alertGdriveNoIdSave: 'BTFileID не задан, сохранение в GDrive пропущено',
        confirmGdriveOverwrite: 'На GDrive более новый BrainTool.org. Перезаписать?\nЛокальные изменения уже есть в любом случае.',
        alertGdriveSaveErr: 'BT — ошибка сохранения на GDrive.',
        alertLocalUnsupported: 'Локальное сохранение не поддерживается в этом браузере (в Brave есть флаг File System Access API: brave://flags)',
        alertLocalSidepanel: 'Локальное сохранение нельзя начать из боковой панели.\n\nУкажите расположение «Окно» или «Вкладка».',
        alertLocalChoose: 'Выберите, где хранить файл BrainTool',
        alertLocalCancel: 'Синхронизация с локальным файлом отменена',
        alertLocalAccess: 'Ошибка доступа к локальному файлу, синхронизация отменена',
        confirmLocalUseExisting: 'Файл BrainTool.org уже есть. OK — использовать его содержимое',
        alertLocalPerm: 'Ошибка запроса доступа к файлу: {err}',
        confirmLocalNewer: 'Файл BrainTool.org на диске новее данных в браузере.\nОтмена — оставить как есть, OK — загрузить новый.',
        alertLocalParse: 'Ошибка разбора BrainTool.org из локального файла:\n{err}',
        alertBackupFolderErr: 'Ошибка создания папки BT-Backups',
        alertBackupStored: 'Резервные копии будут в «{backup}» внутри «{parent}»',
        alertBackupAccess: 'Ошибка доступа к папке BT-Backups',
        exportBookmarksTitle: 'Экспорт BrainTool {date}',
        alertParseOrg: 'Ошибка разбора файла BrainTool.org:\n{err}',
        alertSaveInProgress: 'Сейчас идёт сохранение, подождите несколько секунд и повторите',
        alertProcessFileFail: 'Не удалось обработать файл BT. Проверьте файл на ошибки и перезапустите',
        confirmOpenTabs: 'Открыть {n} вкладок?',
        confirmDeleteSubtree: 'Удалить всё поддерево?',
        warnStaleFileClick: 'В синхронизированном файле BrainTool есть более новые данные. <br/>Нажмите сюда, чтобы обновить, или проигнорируйте — при следующем сохранении файл будет перезаписан.',
        warnGdriveAuthExpired: 'Авторизация GDrive истекла. <br/>Нажмите сюда, чтобы обновить сейчас, иначе попробую при следующем сохранении.',
        warnLocalFileAccess: 'Ошибка доступа к синхронизированному файлу BrainTool{detail}',
        warnLocalFileAccessDetail: ':<br/><small>«{msg}»</small>',
        confirmGdriveExists: 'Файл BrainTool.org уже есть. Последнее изменение: {date}. «OK» — взять его содержимое, «Отмена» — перезаписать локальными данными.',
        confirmGdriveNewer: 'Файл BrainTool.org на GDrive новее данных в браузере.\nОтмена — оставить как есть, OK — загрузить новый.',
        alertGdriveListError: 'BT — ошибка чтения списка файлов GDrive. Проверьте права и повторите',
        alertGdriveListErrorGoogle: 'BT — ошибка чтения списка файлов GDrive. Проверьте права и повторите\nGoogle: {msg}',
        bookmarkImportName: '🔖 Импорт закладок ({date})',
        expandCollapse: 'Развернуть/свернуть',
    }
};

let currentLocale = 'en';

function detectBrowserLocale() {
    const lang = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
    const short = String(lang).toLowerCase().slice(0, 2);
    return SUPPORTED.includes(short) ? short : 'en';
}

/**
 * Resolve locale: explicit BTLocale ('en'|'ru') or 'auto'/empty → browser.
 */
export function resolveLocale(stored) {
    if (stored && SUPPORTED.includes(stored)) return stored;
    return detectBrowserLocale();
}

export function getLocale() {
    return currentLocale;
}

export function getSupportedLocales() {
    return SUPPORTED.slice();
}

/**
 * Translate key. vars: { name: value } → replaces {name} in string.
 */
export function t(key, vars) {
    const cat = catalogs[currentLocale] || catalogs.en;
    let s = cat[key] ?? catalogs.en[key] ?? key;
    if (vars && typeof vars === 'object') {
        for (const [k, v] of Object.entries(vars)) {
            s = s.replaceAll(`{${k}}`, String(v ?? ''));
        }
    }
    return s;
}

/** All tip strings for current locale (Option/Alt substituted). */
export function getTipsArray() {
    const opt = /Mac/i.test(navigator.platform || '') ? t('optionKey') : t('altKey');
    const keys = [];
    for (let i = 0; i < 25; i++) keys.push(t(`tip${i}`, { opt }));
    return keys;
}

export function getMessagesArray() {
    return [0, 1, 2, 3, 4].map(i => t(`msg${i}`));
}

export function getIntroSlidesArray() {
    return [1, 2, 3, 4, 5, 6].map(i => t(`intro${i}`));
}

/**
 * Initialize locale from config (call after config is available) or browser.
 * @param {string|null} storedLocale - getProp('BTLocale') or null
 */
export function initI18n(storedLocale = null) {
    try {
        const stored = storedLocale ?? (typeof getProp === 'function' ? getProp('BTLocale') : null);
        currentLocale = resolveLocale(stored);
    } catch {
        currentLocale = detectBrowserLocale();
    }
    try {
        document.documentElement.lang = currentLocale;
    } catch { /* ignore */ }
    return currentLocale;
}

/**
 * Persist language preference. 'auto' clears override.
 * Caller should reload UI (location.reload) for full effect.
 */
export function setLocalePreference(value) {
    if (value === 'auto' || !value) {
        setProp('BTLocale', 'auto');
        currentLocale = detectBrowserLocale();
    } else if (SUPPORTED.includes(value)) {
        setProp('BTLocale', value);
        currentLocale = value;
    }
    try {
        document.documentElement.lang = currentLocale;
        // Share with extension pages if chrome.storage available
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({ BTLocale: value || 'auto' });
        }
    } catch { /* ignore */ }
    return currentLocale;
}

/**
 * Apply data-i18n / data-i18n-html / data-i18n-aria / data-i18n-title / data-i18n-placeholder
 * on static markup (e.g. index.html dialog).
 */
export function applyStaticDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
}

export { catalogs, SUPPORTED };
