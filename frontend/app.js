import { PALETTES, getPalette, getMode, setPalette, setMode, initTheme } from './theme.js';
import { t, getLang, setLang, initI18n } from './i18n.js';

// Determine API URL based on where the frontend is running
// If running on port 3000 (local dev), point to backend on port 8000
// Otherwise (production/nginx), use relative path '/api'
const API_URL = window.location.port === '3000'
    ? 'http://localhost:8000/api'
    : '/api';

function getClientTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (_) {
        return null;
    }
}

async function syncTimezone() {
    const tz = getClientTimezone();
    if (!tz || !token) return;
    try {
        await fetch(`${API_URL}/set-timezone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ timezone: tz }),
        });
    } catch (_) { /* best-effort */ }
}

function toDatetimeLocalValue(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getLocalYYYYMMDD(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '';
    if (includeTime && dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleString(undefined, {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            });
        }
    }
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    let result = `${day}.${month}.${year}`;
    if (includeTime && dateStr.includes('T')) {
        const timePart = dateStr.split('T')[1];
        const [hours, minutes] = timePart.split(':');
        result += ` ${hours}:${minutes}`;
    }
    return result;
}

// ---------------- State ----------------
let token = localStorage.getItem('access_token');
let allTodos = [];
let currentFilteredTodos = [];
const filters = { status: 'all', priority: 'all', dateFrom: '', dateTo: '', sortBy: 'created', search: '' };

// ---------------- DOM refs ----------------
const authSection = document.getElementById('auth-section');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const todoForm = document.getElementById('todo-form');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const authMessage = document.getElementById('auth-message');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

const settingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModalBtn = document.getElementById('close-settings-modal');
const logoutBtn = document.getElementById('logout-btn');
const changePwForm = document.getElementById('change-pw-form');

const apiTokenValue = document.getElementById('api-token-value');
const mcpUrlValue = document.getElementById('mcp-url-value');
const copyTokenBtn = document.getElementById('copy-token-btn');
const copyMcpUrlBtn = document.getElementById('copy-mcp-url-btn');
const toggleTokenVisibilityBtn = document.getElementById('toggle-token-visibility');
const regenerateTokenBtn = document.getElementById('regenerate-token-btn');

const themeSwatches = document.getElementById('theme-swatches');
const modeSwitch = document.getElementById('mode-switch');
const langSwitch = document.getElementById('lang-switch');

const searchInput = document.getElementById('search-input');
const filterStatusGroup = document.getElementById('filter-status');
const filterPriorityGroup = document.getElementById('filter-priority');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const sortBySelect = document.getElementById('sort-by');
const clearFiltersBtn = document.getElementById('clear-filters');
const exportFormatSelect = document.getElementById('export-format');
const downloadTodosBtn = document.getElementById('download-todos');

const todoModal = document.getElementById('todo-modal');
const openModalBtn = document.getElementById('open-todo-modal');
const closeModalBtn = document.getElementById('close-modal');

const editModal = document.getElementById('edit-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const editForm = document.getElementById('edit-form');
const deleteTodoBtn = document.getElementById('delete-todo-btn');

const alertsSection = document.getElementById('alerts-section');
const alertsList = document.getElementById('alerts-list');

const clockElement = document.getElementById('clock');

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

// ---------------- Init ----------------
function init() {
    initTheme();
    initI18n();
    buildThemeSwatches();
    syncSettingsUI();

    if (token) {
        showApp();
    } else {
        showLogin();
    }

    setInterval(checkReminders, 30000);
    updateClock();
    setInterval(updateClock, 1000);

    searchInput.addEventListener('input', () => { filters.search = searchInput.value.trim().toLowerCase(); applyFilters(); });

    filterStatusGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        setActiveChip(filterStatusGroup, btn);
        filters.status = btn.dataset.value;
        applyFilters();
    });
    filterPriorityGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        setActiveChip(filterPriorityGroup, btn);
        filters.priority = btn.dataset.value;
        applyFilters();
    });
    filterDateFrom.addEventListener('change', () => { filters.dateFrom = filterDateFrom.value; applyFilters(); });
    filterDateTo.addEventListener('change', () => { filters.dateTo = filterDateTo.value; applyFilters(); });
    sortBySelect.addEventListener('change', () => { filters.sortBy = sortBySelect.value; applyFilters(); });

    clearFiltersBtn.addEventListener('click', () => {
        filters.status = 'all'; filters.priority = 'all'; filters.dateFrom = ''; filters.dateTo = '';
        filters.sortBy = 'created'; filters.search = '';
        searchInput.value = '';
        setActiveChip(filterStatusGroup, filterStatusGroup.querySelector('[data-value="all"]'));
        setActiveChip(filterPriorityGroup, filterPriorityGroup.querySelector('[data-value="all"]'));
        filterDateFrom.value = ''; filterDateTo.value = ''; sortBySelect.value = 'created';
        applyFilters();
    });

    downloadTodosBtn.addEventListener('click', downloadTodos);

    // Sidebar drawer (mobile)
    sidebarToggle.addEventListener('click', () => openSidebar());
    sidebarBackdrop.addEventListener('click', () => closeSidebar());

    // New Task modal
    openModalBtn.addEventListener('click', () => { todoModal.classList.remove('hidden'); });
    closeModalBtn.addEventListener('click', () => { todoModal.classList.add('hidden'); });
    closeEditModalBtn.addEventListener('click', () => { editModal.classList.add('hidden'); });

    // Settings modal
    settingsBtn.addEventListener('click', () => { syncSettingsUI(); settingsModal.classList.remove('hidden'); openApiTokenSection(); });
    closeSettingsModalBtn.addEventListener('click', () => { settingsModal.classList.add('hidden'); });

    logoutBtn.addEventListener('click', () => {
        token = null;
        localStorage.removeItem('access_token');
        settingsModal.classList.add('hidden');
        showLogin();
    });

    changePwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = changePwForm.oldPassword.value;
        const newPassword = changePwForm.newPassword.value;
        try {
            const res = await fetch(`${API_URL}/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || t('settings.passwordFailed'));
            }
            alert(t('settings.passwordUpdated'));
            changePwForm.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    toggleTokenVisibilityBtn.addEventListener('click', () => {
        if (apiTokenValue.type === 'password') {
            apiTokenValue.type = 'text';
            toggleTokenVisibilityBtn.textContent = t('settings.hide');
        } else {
            apiTokenValue.type = 'password';
            toggleTokenVisibilityBtn.textContent = t('settings.show');
        }
    });

    copyTokenBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(apiTokenValue.value).then(() => {
            const original = copyTokenBtn.textContent;
            copyTokenBtn.textContent = t('settings.copied');
            setTimeout(() => { copyTokenBtn.textContent = original; }, 2000);
        });
    });

    copyMcpUrlBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(mcpUrlValue.value).then(() => {
            const original = copyMcpUrlBtn.textContent;
            copyMcpUrlBtn.textContent = t('settings.copied');
            setTimeout(() => { copyMcpUrlBtn.textContent = original; }, 2000);
        });
    });

    regenerateTokenBtn.addEventListener('click', async () => {
        if (!confirm(t('settings.regenerateConfirm'))) return;
        try {
            const res = await fetch(`${API_URL}/me/token/regenerate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(t('settings.regenerateFailed'));
            const data = await res.json();
            apiTokenValue.value = data.api_token;
            mcpUrlValue.value = buildMcpUrl(data.api_token);
            apiTokenValue.type = 'password';
            toggleTokenVisibilityBtn.textContent = t('settings.show');
        } catch (err) {
            alert(err.message);
        }
    });

    themeSwatches.addEventListener('click', (e) => {
        const btn = e.target.closest('.swatch-btn');
        if (!btn) return;
        setPalette(btn.dataset.palette);
        syncSettingsUI();
    });
    modeSwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        setMode(btn.dataset.value);
        syncSettingsUI();
    });
    langSwitch.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        setLang(btn.dataset.value);
        syncSettingsUI();
    });

    document.addEventListener('langchange', () => {
        applyFilters();
        checkReminders();
    });

    window.addEventListener('click', (e) => {
        if (e.target === todoModal) todoModal.classList.add('hidden');
        if (e.target === editModal) editModal.classList.add('hidden');
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });
}

function setActiveChip(group, btn) {
    group.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn));
}

function openSidebar() { sidebar.classList.add('open'); sidebarBackdrop.classList.remove('hidden'); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarBackdrop.classList.add('hidden'); }

function buildThemeSwatches() {
    themeSwatches.querySelectorAll('.swatch-btn').forEach((btn) => {
        btn.style.setProperty('--sw', PALETTES.find((p) => p.id === btn.dataset.palette).swatch);
    });
}

function syncSettingsUI() {
    const palette = getPalette();
    const mode = getMode();
    const lang = getLang();
    themeSwatches.querySelectorAll('.swatch-btn').forEach((b) => b.classList.toggle('active', b.dataset.palette === palette));
    modeSwitch.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b.dataset.value === mode));
    langSwitch.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b.dataset.value === lang));
}

function checkReminders() {
    if (!allTodos || allTodos.length === 0) { alertsSection.classList.add('hidden'); return; }

    const now = new Date();
    const todayStr = getLocalYYYYMMDD(now);
    const alerts = [];

    allTodos.forEach((todo) => {
        if (todo.done) return;
        let isAlert = false, alertType = '';
        if (todo.due_date && todo.due_date < todayStr) {
            isAlert = true; alertType = t('alerts.overdue');
        } else if (todo.remind_from) {
            const remindTime = new Date(todo.remind_from);
            if (now >= remindTime) { isAlert = true; alertType = t('alerts.reminder'); }
        }
        if (isAlert) alerts.push({ title: todo.title, dueDate: todo.due_date, type: alertType, id: todo.id });
    });

    renderAlerts(alerts);
}

function renderAlerts(alerts) {
    if (alerts.length === 0) { alertsSection.classList.add('hidden'); return; }
    alertsList.innerHTML = '';
    alerts.forEach((alert) => {
        const li = document.createElement('li');
        const dateText = alert.dueDate ? formatDate(alert.dueDate) : t('alerts.noDate');
        li.innerHTML = `<span><strong>${escapeHtml(alert.type)}:</strong> ${escapeHtml(alert.title)}</span><small>${t('alerts.due')}: ${escapeHtml(dateText)}</small>`;
        alertsList.appendChild(li);
    });
    alertsSection.classList.remove('hidden');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

// ---------------- Navigation ----------------
function showLogin() {
    authSection.classList.remove('hidden');
    appShell.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    authMessage.textContent = '';
}

function showApp() {
    authSection.classList.add('hidden');
    appShell.classList.remove('hidden');
    syncTimezone();
    fetchTodos();
}

showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authMessage.textContent = '';
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authMessage.textContent = '';
});

// ---------------- Auth actions ----------------
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.username.value;
    const password = loginForm.password.value;

    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const res = await fetch(`${API_URL}/login`, { method: 'POST', body: formData });
        if (!res.ok) {
            let msg = t('auth.loginFailed');
            try { const errData = await res.json(); msg = errData.detail || msg; } catch (_) {}
            throw new Error(msg);
        }
        const data = await res.json();
        token = data.access_token;
        localStorage.setItem('access_token', token);
        loginForm.reset();
        showApp();
    } catch (err) {
        authMessage.textContent = err.message || t('auth.loginFailed');
        authMessage.style.color = 'var(--danger)';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = registerForm.email.value;
    const password = registerForm.password.value;
    const timezone = getClientTimezone();

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, timezone }),
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || t('auth.registerFailed'));
        }
        authMessage.textContent = t('auth.registerSuccess');
        authMessage.style.color = 'var(--success)';
        registerForm.reset();
        showLoginBtn.click();
    } catch (err) {
        authMessage.textContent = err.message;
        authMessage.style.color = 'var(--danger)';
    }
});

// ---------------- Todo actions ----------------
async function fetchTodos() {
    try {
        const res = await fetch(`${API_URL}/todos`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { logoutBtn.click(); return; }
        allTodos = await res.json();
        applyFilters();
        checkReminders();
    } catch (err) {
        console.error('Error fetching todos:', err);
    }
}

function applyFilters() {
    const { status, priority, dateFrom, dateTo, sortBy, search } = filters;
    let filtered = [...allTodos];

    if (status === 'active') filtered = filtered.filter((t) => !t.done);
    else if (status === 'done') filtered = filtered.filter((t) => t.done);

    if (priority !== 'all') filtered = filtered.filter((t) => t.priority === parseInt(priority, 10));

    if (dateFrom) filtered = filtered.filter((t) => t.due_date && t.due_date >= dateFrom);
    if (dateTo) filtered = filtered.filter((t) => t.due_date && t.due_date <= dateTo);

    if (search) {
        filtered = filtered.filter((t) =>
            (t.title || '').toLowerCase().includes(search) ||
            (t.description || '').toLowerCase().includes(search));
    }

    filtered.sort((a, b) => {
        if (sortBy === 'priority') return b.priority - a.priority;
        if (sortBy === 'dueDate') {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date.localeCompare(b.due_date);
        }
        return a.id - b.id;
    });

    currentFilteredTodos = filtered;
    renderTodos(filtered);
}

function downloadTodos() {
    if (!currentFilteredTodos || currentFilteredTodos.length === 0) {
        alert(t('export.noTasks'));
        return;
    }
    const format = exportFormatSelect.value;
    if (format === 'pos') downloadPos(currentFilteredTodos);
    else downloadHtml(currentFilteredTodos);
}

function downloadPos(todos) {
    const width = 32;
    const line = '-'.repeat(width);
    const dotted = '- '.repeat(width / 2);
    const now = new Date();

    let text = '';
    const title = t('export.posTitle');
    const padding = Math.floor((width - title.length) / 2);
    text += ' '.repeat(Math.max(padding, 0)) + title + '\n';
    text += now.toLocaleString() + '\n';
    text += line + '\n';

    todos.forEach((todo) => {
        const box = todo.done ? '[x] ' : '[ ] ';
        const fullTitle = box + todo.title;
        const words = fullTitle.split(' ');
        let currentLine = '';
        words.forEach((word) => {
            if ((currentLine + word).length > width) {
                text += currentLine.trim() + '\n';
                currentLine = '    ' + word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });
        text += currentLine.trim() + '\n';

        if (todo.due_date) text += `${t('export.posDue')}: ${formatDate(todo.due_date)}\n`;
        const prio = todo.priority === 2 ? t('nav.priority.high') : (todo.priority === 1 ? t('nav.priority.medium') : t('nav.priority.low'));
        text += `${t('export.posPriority')}: ${prio}\n`;
        text += dotted + '\n';
    });

    text += '\n\n\n';

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>POS Print</title>
            <style>
                body { margin: 0; padding: 0; }
                pre { font-family: 'Courier New', Courier, monospace; font-size: 24px; font-weight: bold; color: black; white-space: pre; margin: 0; }
                @media print { @page { margin: 0; } body { margin: 0; } }
            </style>
        </head>
        <body>
            <pre>${escapeHtml(text)}</pre>
            <script>
                window.onload = function () {
                    window.print();
                    window.onafterprint = function () { window.close(); };
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadHtml(todos) {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${escapeHtml(t('export.pageTitle'))}</title>
        <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .done { text-decoration: line-through; color: #888; }
            .priority-2 { color: #dc3545; font-weight: bold; }
            .priority-1 { color: #856404; font-weight: bold; }
            .priority-0 { color: #28a745; font-weight: bold; }
        </style>
    </head>
    <body>
        <h1>${escapeHtml(t('export.pageTitle'))}</h1>
        <p>${escapeHtml(t('export.exportedOn'))}: ${dateStr} ${timeStr}</p>
        <table>
            <thead>
                <tr>
                    <th>${escapeHtml(t('export.status'))}</th>
                    <th>${escapeHtml(t('export.priorityCol'))}</th>
                    <th>${escapeHtml(t('export.titleCol'))}</th>
                    <th>${escapeHtml(t('export.dueDateCol'))}</th>
                    <th>${escapeHtml(t('export.descriptionCol'))}</th>
                </tr>
            </thead>
            <tbody>
    `;

    todos.forEach((todo) => {
        const status = todo.done ? t('export.completed') : t('export.active');
        const priorityLabel = todo.priority === 2 ? t('nav.priority.high') : (todo.priority === 1 ? t('nav.priority.medium') : t('nav.priority.low'));
        const rowClass = todo.done ? 'done' : '';
        const priorityClass = `priority-${todo.priority}`;
        htmlContent += `
            <tr class="${rowClass}">
                <td>${escapeHtml(status)}</td>
                <td class="${priorityClass}">${escapeHtml(priorityLabel)}</td>
                <td>${escapeHtml(todo.title)}</td>
                <td>${todo.due_date ? escapeHtml(formatDate(todo.due_date)) : '-'}</td>
                <td>${escapeHtml(todo.description) || '-'}</td>
            </tr>
        `;
    });

    htmlContent += `
            </tbody>
        </table>
        <script>window.print();<\/script>
    </body>
    </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-list-${now.toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newTodo = {
        title: todoForm.title.value,
        description: todoForm.description.value || null,
        priority: parseInt(todoForm.priority.value, 10),
        due_date: todoForm.dueDate.value || null,
        remind_from: todoForm.remindFrom.value || null,
        email_reminder_enabled: !!todoForm.emailReminder?.checked,
        done: false,
    };
    try {
        const res = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newTodo),
        });
        if (res.ok) {
            todoForm.reset();
            todoModal.classList.add('hidden');
            fetchTodos();
        }
    } catch (err) {
        console.error('Error creating todo:', err);
    }
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editForm.id.value;
    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                title: editForm.title.value,
                description: editForm.description.value || null,
                priority: parseInt(editForm.priority.value, 10),
                due_date: editForm.dueDate.value || null,
                remind_from: editForm.remindFrom.value || null,
                email_reminder_enabled: !!editForm.emailReminder?.checked,
                done: editForm.done.checked,
            }),
        });
        if (res.ok) { editModal.classList.add('hidden'); fetchTodos(); }
    } catch (err) {
        console.error('Error updating todo:', err);
    }
});

deleteTodoBtn.addEventListener('click', async () => {
    const id = editForm.id.value;
    if (!id || deleteTodoBtn.disabled) return;
    if (!confirm(t('confirm.deleteTodo'))) return;
    try {
        const res = await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) { editModal.classList.add('hidden'); fetchTodos(); }
    } catch (err) {
        console.error('Error deleting todo:', err);
    }
});

async function toggleTodo(id) {
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return;
    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                title: todo.title,
                description: todo.description || null,
                priority: todo.priority,
                due_date: todo.due_date || null,
                remind_from: todo.remind_from || null,
                email_reminder_enabled: !!todo.email_reminder_enabled,
                done: !todo.done,
            }),
        });
        if (res.ok) fetchTodos();
    } catch (err) {
        console.error('Error toggling todo:', err);
    }
}

// ---------------- Rendering ----------------
function openEditModal(id) {
    const todo = allTodos.find((t) => t.id === id);
    if (!todo) return;

    editForm.id.value = todo.id;
    editForm.title.value = todo.title;
    editForm.description.value = todo.description || '';
    editForm.priority.value = todo.priority;
    editForm.dueDate.value = todo.due_date || '';
    editForm.done.checked = todo.done;
    editForm.emailReminder.checked = !!todo.email_reminder_enabled;
    editForm.remindFrom.value = todo.remind_from ? toDatetimeLocalValue(todo.remind_from) : '';

    // Business rule (matches the old frontend and the backend's lack of
    // server-side enforcement): a todo can only be deleted once it's done.
    const updateDeleteBtnState = () => {
        deleteTodoBtn.disabled = !editForm.done.checked;
        deleteTodoBtn.title = editForm.done.checked ? t('form.deleteEnabledTitle') : t('form.deleteDisabledTitle');
        deleteTodoBtn.style.opacity = editForm.done.checked ? '1' : '0.5';
        deleteTodoBtn.style.cursor = editForm.done.checked ? 'pointer' : 'not-allowed';
    };
    updateDeleteBtnState();
    editForm.done.onchange = updateDeleteBtnState;

    editModal.classList.remove('hidden');
}

function renderTodos(todos) {
    todoList.innerHTML = '';
    emptyState.classList.toggle('hidden', todos.length > 0);

    const now = new Date();
    const todayStr = getLocalYYYYMMDD(now);

    todos.forEach((todo) => {
        const li = document.createElement('li');

        let priorityClass = 'p-low';
        if (todo.priority >= 2) priorityClass = 'p-high';
        else if (todo.priority === 1) priorityClass = 'p-medium';

        let statusClass = '';
        if (!todo.done) {
            if (todo.due_date && todo.due_date < todayStr) statusClass = 'overdue';
            else if (todo.remind_from && now >= new Date(todo.remind_from)) statusClass = 'reminder-active';
        }

        li.className = `todo-card ${todo.done ? 'done' : ''} ${statusClass}`;
        li.tabIndex = 0;
        li.setAttribute('role', 'button');

        const metaChips = [];
        if (todo.due_date) {
            metaChips.push(`<span class="todo-chip ${statusClass === 'overdue' ? 'overdue' : ''}">${t('alerts.due')}: ${escapeHtml(formatDate(todo.due_date))}</span>`);
        }
        if (todo.remind_from) {
            metaChips.push(`<span class="todo-chip ${statusClass === 'reminder-active' ? 'reminder' : ''}">${escapeHtml(t('form.remindFrom'))}: ${escapeHtml(formatDate(todo.remind_from, true))}</span>`);
        }

        li.innerHTML = `
            <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} aria-label="${escapeHtml(t('form.markDone'))}">
            <div class="todo-main">
                <div class="todo-title-row">
                    <span class="todo-priority-dot ${priorityClass}"></span>
                    <span class="todo-title">${escapeHtml(todo.title)}</span>
                </div>
                ${todo.description ? `<div class="todo-desc">${escapeHtml(todo.description)}</div>` : ''}
                ${metaChips.length ? `<div class="todo-meta">${metaChips.join('')}</div>` : ''}
            </div>
        `;

        const checkbox = li.querySelector('.todo-checkbox');
        checkbox.addEventListener('click', (e) => { e.stopPropagation(); toggleTodo(todo.id); });

        const openHandler = () => openEditModal(todo.id);
        li.addEventListener('click', openHandler);
        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHandler(); }
        });

        todoList.appendChild(li);
    });
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockElement) clockElement.textContent = `${hours}:${minutes}`;
}

function buildMcpUrl(apiToken) {
    const base = window.location.origin.replace('todo.', 'mcp.');
    return `${base}/mcp?token=${apiToken}`;
}

async function openApiTokenSection() {
    apiTokenValue.value = '';
    mcpUrlValue.value = '';
    apiTokenValue.type = 'password';
    toggleTokenVisibilityBtn.textContent = t('settings.show');
    try {
        const res = await fetch(`${API_URL}/me/token`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(t('settings.tokenLoadFailed'));
        const data = await res.json();
        apiTokenValue.value = data.api_token;
        mcpUrlValue.value = buildMcpUrl(data.api_token);
    } catch (err) {
        console.error(err);
    }
}

// Start
init();
