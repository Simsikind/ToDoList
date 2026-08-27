// Minimal i18n: flat key -> string dictionaries for German/English, a t()
// lookup helper, and a DOM pass that fills in [data-i18n*] attributes.
// Detects navigator.language on first visit, remembers an explicit choice
// in localStorage from then on.

const LANG_KEY = 'lang';

const dict = {
    de: {
        'app.newTask': 'Neue Aufgabe',
        'app.settings': 'Einstellungen',
        'app.search': 'Aufgaben durchsuchen…',

        'nav.status': 'Status',
        'nav.all': 'Alle',
        'nav.active': 'Aktiv',
        'nav.done': 'Erledigt',
        'nav.priority': 'Priorität',
        'nav.priority.all': 'Alle',
        'nav.priority.high': 'Hoch',
        'nav.priority.medium': 'Mittel',
        'nav.priority.low': 'Niedrig',
        'nav.tags': 'Tags',
        'nav.dueRange': 'Fälligkeitszeitraum',
        'nav.dueFrom': 'Von',
        'nav.dueTo': 'Bis',
        'nav.sortBy': 'Sortieren nach',
        'sort.created': 'Erstellt',
        'sort.priority': 'Priorität (hoch → niedrig)',
        'sort.dueDate': 'Fälligkeit (früheste zuerst)',
        'nav.clearFilters': 'Filter zurücksetzen',
        'nav.export': 'Export',
        'export.html': 'HTML',
        'export.pos': 'Bon (Text)',
        'export.go': 'Exportieren',
        'export.noTasks': 'Keine Aufgaben zum Exportieren!',

        'alerts.title': 'Benachrichtigungen:',
        'alerts.overdue': 'Überfällig',
        'alerts.reminder': 'Erinnerung',
        'alerts.noDate': 'Kein Datum',
        'alerts.due': 'Fällig',

        'empty.title': 'Keine Aufgaben',
        'empty.body': 'Für die aktuellen Filter gibt es nichts zu zeigen.',

        'auth.loginTitle': 'Anmelden',
        'auth.registerTitle': 'Registrieren',
        'auth.email': 'E-Mail',
        'auth.password': 'Passwort',
        'auth.confirmPassword': 'Passwort bestätigen',
        'auth.loginBtn': 'Anmelden',
        'auth.registerBtn': 'Registrieren',
        'auth.noAccount': 'Noch kein Konto?',
        'auth.registerLink': 'Registrieren',
        'auth.haveAccount': 'Schon ein Konto?',
        'auth.loginLink': 'Anmelden',
        'auth.registerSuccess': 'Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse (ggf. im Spam-Ordner nachsehen) und melde dich danach an.',
        'auth.loginFailed': 'Anmeldung fehlgeschlagen. Zugangsdaten prüfen.',
        'auth.registerFailed': 'Registrierung fehlgeschlagen',

        'modal.newTask': 'Neue Aufgabe',
        'modal.editTask': 'Aufgabe bearbeiten',
        'form.title': 'Titel',
        'form.titlePlaceholder': 'Was ist zu tun? (max. 50 Zeichen)',
        'form.description': 'Beschreibung',
        'form.descPlaceholder': 'Optionale Details… (max. 200 Zeichen)',
        'form.priority': 'Priorität (0–2)',
        'form.dueDate': 'Fälligkeitsdatum',
        'form.remindFrom': 'Erinnern ab',
        'form.emailReminder': 'E-Mail-Erinnerung',
        'form.markDone': 'Als erledigt markieren',
        'form.addTodo': 'Aufgabe hinzufügen',
        'form.saveChanges': 'Änderungen speichern',
        'form.delete': 'Löschen',
        'form.deleteDisabledTitle': 'Erst erledigen, um zu löschen',
        'form.deleteEnabledTitle': 'Diese Aufgabe löschen',
        'form.tags': 'Tags',
        'form.tagsPlaceholder': 'Tag eingeben, Enter zum Hinzufügen',
        'form.recurrence': 'Wiederholung',
        'form.recurrenceNeedsDueDate': 'Setze ein Fälligkeitsdatum, um eine Wiederholung zu nutzen.',
        'form.recurrenceHint': 'Beim Abhaken wird automatisch die nächste Aufgabe erstellt.',
        'recurrence.none': 'Keine',
        'recurrence.daily': 'Täglich',
        'recurrence.weekly': 'Wöchentlich',
        'recurrence.monthly': 'Monatlich',
        'recurrence.weekdays': 'Bestimmte Wochentage',
        'weekday.short.1': 'Mo',
        'weekday.short.2': 'Di',
        'weekday.short.3': 'Mi',
        'weekday.short.4': 'Do',
        'weekday.short.5': 'Fr',
        'weekday.short.6': 'Sa',
        'weekday.short.7': 'So',

        'settings.title': 'Einstellungen',
        'settings.appearance': 'Erscheinungsbild',
        'settings.theme': 'Farbschema',
        'settings.mode': 'Modus',
        'mode.light': 'Hell',
        'mode.dark': 'Dunkel',
        'mode.system': 'System',
        'settings.language': 'Sprache',
        'settings.account': 'Konto',
        'settings.oldPassword': 'Aktuelles Passwort',
        'settings.newPassword': 'Neues Passwort',
        'settings.confirmNewPassword': 'Neues Passwort bestätigen',
        'settings.updatePassword': 'Passwort aktualisieren',
        'error.passwordMismatch': 'Die Passwörter stimmen nicht überein.',
        'settings.passwordUpdated': 'Passwort erfolgreich aktualisiert!',
        'settings.passwordFailed': 'Passwort konnte nicht aktualisiert werden',
        'settings.apiAccess': 'API-Zugriff',
        'settings.apiAccessHint': 'Mit diesem Token kannst du externe Dienste (z.B. Claude MCP) mit deinem Konto verbinden. Behandle es wie ein Passwort.',
        'settings.apiToken': 'Dein API-Token',
        'settings.show': 'Anzeigen',
        'settings.hide': 'Verbergen',
        'settings.copy': 'Kopieren',
        'settings.copied': 'Kopiert!',
        'settings.mcpUrl': 'MCP-Server-URL (für claude.ai)',
        'settings.regenerateToken': 'Neuen Token generieren',
        'settings.regenerateWarning': 'Bisherige Verbindungen werden dadurch ungültig.',
        'settings.regenerateConfirm': 'Einen neuen Token generieren? Bisherige Verbindungen werden dadurch ungültig.',
        'settings.regenerateFailed': 'Fehler beim Generieren des Tokens',
        'settings.tokenLoadFailed': 'Fehler beim Laden des Tokens',
        'settings.logout': 'Abmelden',

        'confirm.deleteTodo': 'Diese Aufgabe löschen?',

        'footer.privacy': 'Datenschutz',
        'footer.doc': 'Doku',

        'settings.admin': 'Admin-Dashboard',

        'admin.title': 'Admin-Dashboard',
        'admin.notLoggedIn': 'Bitte zuerst anmelden.',
        'admin.notLoggedInLink': 'Zur Anmeldung',
        'admin.noAccess': 'Kein Admin-Zugriff mit diesem Konto.',
        'admin.backToApp': 'Zurück zur App',
        'admin.colEmail': 'E-Mail',
        'admin.colVerified': 'Verifiziert',
        'admin.colCreated': 'Registriert am',
        'admin.colLastLogin': 'Letzter Login',
        'admin.colOpen': 'Offen',
        'admin.colDone': 'Erledigt',
        'admin.colRole': 'Rolle',
        'admin.colAction': 'Aktion',
        'admin.roleOwner': 'Owner',
        'admin.roleAdmin': 'Admin',
        'admin.roleUser': 'User',
        'admin.deleteDone': 'Erledigte löschen',
        'admin.deleteDoneConfirm': 'Alle erledigten Aufgaben dieses Users unwiderruflich löschen?',
        'admin.never': 'Nie',
        'admin.yes': 'Ja',
        'admin.no': 'Nein',

        'export.pageTitle': 'ToDo-Liste Export',
        'export.exportedOn': 'Exportiert am',
        'export.status': 'Status',
        'export.active': 'Aktiv',
        'export.completed': 'Erledigt',
        'export.priorityCol': 'Priorität',
        'export.titleCol': 'Titel',
        'export.dueDateCol': 'Fälligkeit',
        'export.descriptionCol': 'Beschreibung',
        'export.tagsCol': 'Tags',
        'export.posTitle': 'ToDo Liste',
        'export.posDue': 'Fällig',
        'export.posPriority': 'Prio',
        'export.posTags': 'Tags',
    },
    en: {
        'app.newTask': 'New Task',
        'app.settings': 'Settings',
        'app.search': 'Search tasks…',

        'nav.status': 'Status',
        'nav.all': 'All',
        'nav.active': 'Active',
        'nav.done': 'Completed',
        'nav.priority': 'Priority',
        'nav.priority.all': 'All',
        'nav.priority.high': 'High',
        'nav.priority.medium': 'Medium',
        'nav.priority.low': 'Low',
        'nav.tags': 'Tags',
        'nav.dueRange': 'Due date range',
        'nav.dueFrom': 'From',
        'nav.dueTo': 'To',
        'nav.sortBy': 'Sort by',
        'sort.created': 'Created',
        'sort.priority': 'Priority (high to low)',
        'sort.dueDate': 'Due date (earliest first)',
        'nav.clearFilters': 'Clear filters',
        'nav.export': 'Export',
        'export.html': 'HTML',
        'export.pos': 'Receipt (Text)',
        'export.go': 'Export',
        'export.noTasks': 'No tasks to export!',

        'alerts.title': 'Notifications:',
        'alerts.overdue': 'Overdue',
        'alerts.reminder': 'Reminder',
        'alerts.noDate': 'No date',
        'alerts.due': 'Due',

        'empty.title': 'No tasks',
        'empty.body': 'Nothing matches the current filters.',

        'auth.loginTitle': 'Login',
        'auth.registerTitle': 'Register',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.confirmPassword': 'Confirm password',
        'auth.loginBtn': 'Login',
        'auth.registerBtn': 'Register',
        'auth.noAccount': "Don't have an account?",
        'auth.registerLink': 'Register',
        'auth.haveAccount': 'Already have an account?',
        'auth.loginLink': 'Login',
        'auth.registerSuccess': 'Registration successful! Please check your email to verify your address (it may be in your spam folder), then log in.',
        'auth.loginFailed': 'Login failed. Check credentials.',
        'auth.registerFailed': 'Registration failed',

        'modal.newTask': 'Add New Task',
        'modal.editTask': 'Edit Task',
        'form.title': 'Title',
        'form.titlePlaceholder': 'What needs to be done? (max 50 chars)',
        'form.description': 'Description',
        'form.descPlaceholder': 'Optional details… (max 200 chars)',
        'form.priority': 'Priority (0–2)',
        'form.dueDate': 'Due date',
        'form.remindFrom': 'Remind from',
        'form.emailReminder': 'Email reminder',
        'form.markDone': 'Mark as done',
        'form.addTodo': 'Add Todo',
        'form.saveChanges': 'Save Changes',
        'form.delete': 'Delete',
        'form.deleteDisabledTitle': 'Complete task to delete',
        'form.deleteEnabledTitle': 'Delete this task',
        'form.tags': 'Tags',
        'form.tagsPlaceholder': 'Type a tag, Enter to add',
        'form.recurrence': 'Repeat',
        'form.recurrenceNeedsDueDate': 'Set a due date to use repeat.',
        'form.recurrenceHint': 'Completing it automatically creates the next occurrence.',
        'recurrence.none': 'None',
        'recurrence.daily': 'Daily',
        'recurrence.weekly': 'Weekly',
        'recurrence.monthly': 'Monthly',
        'recurrence.weekdays': 'Specific weekdays',
        'weekday.short.1': 'Mon',
        'weekday.short.2': 'Tue',
        'weekday.short.3': 'Wed',
        'weekday.short.4': 'Thu',
        'weekday.short.5': 'Fri',
        'weekday.short.6': 'Sat',
        'weekday.short.7': 'Sun',

        'settings.title': 'Settings',
        'settings.appearance': 'Appearance',
        'settings.theme': 'Theme',
        'settings.mode': 'Mode',
        'mode.light': 'Light',
        'mode.dark': 'Dark',
        'mode.system': 'System',
        'settings.language': 'Language',
        'settings.account': 'Account',
        'settings.oldPassword': 'Old password',
        'settings.newPassword': 'New password',
        'settings.confirmNewPassword': 'Confirm new password',
        'settings.updatePassword': 'Update password',
        'error.passwordMismatch': "Passwords don't match.",
        'settings.passwordUpdated': 'Password updated successfully!',
        'settings.passwordFailed': 'Failed to update password',
        'settings.apiAccess': 'API Access',
        'settings.apiAccessHint': 'Use this token to connect external services (e.g. Claude MCP) to your account. Treat it like a password.',
        'settings.apiToken': 'Your API token',
        'settings.show': 'Show',
        'settings.hide': 'Hide',
        'settings.copy': 'Copy',
        'settings.copied': 'Copied!',
        'settings.mcpUrl': 'MCP Server URL (for claude.ai)',
        'settings.regenerateToken': 'Generate new token',
        'settings.regenerateWarning': 'Existing connections will stop working.',
        'settings.regenerateConfirm': 'Generate a new token? Existing connections will stop working.',
        'settings.regenerateFailed': 'Failed to generate token',
        'settings.tokenLoadFailed': 'Failed to load token',
        'settings.logout': 'Log out',

        'confirm.deleteTodo': 'Delete this task?',

        'footer.privacy': 'Privacy',
        'footer.doc': 'Docs',

        'settings.admin': 'Admin Dashboard',

        'admin.title': 'Admin Dashboard',
        'admin.notLoggedIn': 'Please log in first.',
        'admin.notLoggedInLink': 'Go to login',
        'admin.noAccess': 'No admin access with this account.',
        'admin.backToApp': 'Back to app',
        'admin.colEmail': 'Email',
        'admin.colVerified': 'Verified',
        'admin.colCreated': 'Registered on',
        'admin.colLastLogin': 'Last login',
        'admin.colOpen': 'Open',
        'admin.colDone': 'Done',
        'admin.colRole': 'Role',
        'admin.colAction': 'Action',
        'admin.roleOwner': 'Owner',
        'admin.roleAdmin': 'Admin',
        'admin.roleUser': 'User',
        'admin.deleteDone': 'Delete completed',
        'admin.deleteDoneConfirm': "Permanently delete all of this user's completed tasks?",
        'admin.never': 'Never',
        'admin.yes': 'Yes',
        'admin.no': 'No',

        'export.pageTitle': 'ToDo List Export',
        'export.exportedOn': 'Exported on',
        'export.status': 'Status',
        'export.active': 'Active',
        'export.completed': 'Completed',
        'export.priorityCol': 'Priority',
        'export.titleCol': 'Title',
        'export.dueDateCol': 'Due Date',
        'export.descriptionCol': 'Description',
        'export.tagsCol': 'Tags',
        'export.posTitle': 'ToDo List',
        'export.posDue': 'Due',
        'export.posPriority': 'Pri',
        'export.posTags': 'Tags',
    },
};

const LANGS = Object.keys(dict);

function detectInitialLang() {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && LANGS.includes(stored)) return stored;
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase();
    return LANGS.includes(nav) ? nav : 'de';
}

let currentLang = detectInitialLang();

export function getLang() {
    return currentLang;
}

export function t(key) {
    return (dict[currentLang] && dict[currentLang][key]) || dict.de[key] || key;
}

export function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
        el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
}

export function setLang(lang) {
    if (!LANGS.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent('langchange'));
}

export function initI18n() {
    document.documentElement.setAttribute('lang', currentLang);
    applyTranslations();
}