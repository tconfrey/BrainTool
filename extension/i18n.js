/**
 * i18n for extension pages (popup). Mirrors app language keys used by the Bookmarker UI.
 * Uses chrome.storage BTLocale when set; else browser UI language.
 */

'use strict';

const SUPPORTED = ['en', 'ru'];

const catalogs = {
    en: {
        welcomeTitle: 'Welcome to BrainTool',
        welcomeMessage: "To get you started I'm going to:<br/>- Open the Topic Manager on the left of this window.<br/>- Nudge this window right to make sure the Topic Manager is visible.<br/>- Open a tab to the Welcome page with new user information.<br/>",
        openingMessage: 'Opening the BrainTool Topic Manager at its previously saved location...',
        upgradeMessage: 'Upgrading to BrainTool <span id="upgradeVersion"></span>. <br/>Please re-open the Topic Manager. <br/>Release Notes will open if necessary, after restart.',
        sidepanelMessage: 'Open BrainTool in the sidepanel?',
        ok: 'OK',
        bookmarkerTitle: 'BrainTool Bookmarker',
        warningStale: 'Warning! <br/>Synced BrainTool file has newer data. <br/>Refresh from the Topic Manager before saving.',
        pageTitle: 'Page Title',
        saveAsNew: 'Note this will save as a new page.',
        multiplePages: 'Multiple Pages',
        saveTab: 'Save Tab',
        saveWindow: 'Save Window',
        saveTabGroup: 'Save TabGroup',
        saveSession: 'Save Session',
        saveHint: 'Pinned or already-saved tabs are not saved',
        topicSaveUnder: 'Topic to save the page under:',
        topicSavePages: 'Topic to save pages to:',
        topicSaveTg: 'Optional parent Topic to save tabs in "{name}" to:',
        newTopicHint: 'Select from below, type for autocomplete, or leave blank',
        topicTree: 'Topic tree:',
        pageTitleLabel: 'Page title:',
        noteLabel: 'Note:',
        newNoteHint: 'Add a note or just hit enter to save',
        saveAndClose: 'Save and close',
        save: 'Save',
        alertPinned: 'BrainTool does not handle pinned tabs. Unpin the tab and try again.',
        alertWindowError: 'Error creating the TopicManager window. Chrome says: {err}\n Using a tab instead...',
        topicManagerTitle: 'BrainTool Topic Manager',
    },
    ru: {
        welcomeTitle: 'Добро пожаловать в BrainTool',
        welcomeMessage: 'Чтобы начать, я сделаю следующее:<br/>— Открою менеджер тем слева от этого окна.<br/>— Сдвину это окно вправо, чтобы менеджер тем был виден.<br/>— Открою вкладку со страницей приветствия для новых пользователей.<br/>',
        openingMessage: 'Открываю менеджер тем BrainTool в сохранённом ранее расположении...',
        upgradeMessage: 'Обновление BrainTool <span id="upgradeVersion"></span>. <br/>Откройте менеджер тем снова. <br/>При необходимости после перезапуска откроются заметки о выпуске.',
        sidepanelMessage: 'Открыть BrainTool в боковой панели?',
        ok: 'OK',
        bookmarkerTitle: 'BrainTool Bookmarker',
        warningStale: 'Внимание! <br/>Синхронизированный файл BrainTool новее. <br/>Обновите данные из менеджера тем перед сохранением.',
        pageTitle: 'Заголовок страницы',
        saveAsNew: 'Будет сохранено как новая страница.',
        multiplePages: 'Несколько страниц',
        saveTab: 'Сохранить вкладку',
        saveWindow: 'Сохранить окно',
        saveTabGroup: 'Сохранить группу вкладок',
        saveSession: 'Сохранить сеанс',
        saveHint: 'Закреплённые и уже сохранённые вкладки не сохраняются',
        topicSaveUnder: 'Тема для сохранения страницы:',
        topicSavePages: 'Тема для сохранения страниц:',
        topicSaveTg: 'Необязательная родительская тема для вкладок «{name}»:',
        newTopicHint: 'Выберите ниже, введите с автодополнением или оставьте пустым',
        topicTree: 'Дерево тем:',
        pageTitleLabel: 'Заголовок страницы:',
        noteLabel: 'Заметка:',
        newNoteHint: 'Добавьте заметку или нажмите Enter для сохранения',
        saveAndClose: 'Сохранить и закрыть',
        save: 'Сохранить',
        alertPinned: 'BrainTool не работает с закреплёнными вкладками. Открепите вкладку и попробуйте снова.',
        alertWindowError: 'Ошибка создания окна менеджера тем. Chrome сообщает: {err}\n Используем вкладку...',
        // Must match document.title of Topic Manager (kept English for tab queries)
        topicManagerTitle: 'BrainTool Topic Manager',
    }
};

let currentLocale = 'en';

function detectBrowserLocale() {
    try {
        if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
            const ui = chrome.i18n.getUILanguage().toLowerCase().slice(0, 2);
            if (SUPPORTED.includes(ui)) return ui;
        }
    } catch { /* ignore */ }
    const lang = (navigator.language || 'en').toLowerCase().slice(0, 2);
    return SUPPORTED.includes(lang) ? lang : 'en';
}

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

export async function initI18n() {
    let stored = null;
    try {
        const v = await chrome.storage.local.get(['BTLocale']);
        stored = v.BTLocale;
    } catch { /* ignore */ }
    if (stored && SUPPORTED.includes(stored)) {
        currentLocale = stored;
    } else {
        currentLocale = detectBrowserLocale();
    }
    document.documentElement.lang = currentLocale;
    return currentLocale;
}

export function applyStaticDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        // Preserve child elements with ids where possible by only setting if no special children needed
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
}

export function getLocale() {
    return currentLocale;
}
