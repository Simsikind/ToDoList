import { t, initI18n } from './i18n.js?v=4';

const API_URL = window.location.port === '3000'
    ? 'http://localhost:8000/api'
    : '/api';

const token = localStorage.getItem('access_token');

const messageEl = document.getElementById('admin-message');
const tableWrap = document.getElementById('admin-table-wrap');
const tableBody = document.getElementById('admin-table-body');

function showMessage(html) {
    messageEl.innerHTML = html;
    messageEl.classList.remove('hidden');
    tableWrap.classList.add('hidden');
}

function formatDateTime(iso) {
    if (!iso) return t('admin.never');
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

async function apiGet(path) {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
    return res;
}

function roleBadgeHtml(user) {
    if (user.is_owner) return `<span class="admin-badge owner">${t('admin.roleOwner')}</span>`;
    if (user.is_admin) return `<span class="admin-badge admin">${t('admin.roleAdmin')}</span>`;
    return `<span class="admin-badge user">${t('admin.roleUser')}</span>`;
}

function renderRow(user, viewerIsOwner) {
    const tr = document.createElement('tr');

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'admin-delete-btn';
    deleteBtn.textContent = `${t('admin.deleteDone')} (${user.todos_done})`;
    deleteBtn.disabled = user.todos_done === 0;
    deleteBtn.addEventListener('click', async () => {
        if (!confirm(t('admin.deleteDoneConfirm'))) return;
        deleteBtn.disabled = true;
        try {
            await fetch(`${API_URL}/admin/users/${user.id}/done-todos`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            await loadUsers();
        } catch (_) {
            deleteBtn.disabled = false;
        }
    });

    tr.innerHTML = `
        <td>${escapeHtml(user.email)}</td>
        <td><span class="admin-badge ${user.is_email_verified ? 'yes' : 'no'}">${user.is_email_verified ? t('admin.yes') : t('admin.no')}</span></td>
        <td>${formatDateTime(user.created_at)}</td>
        <td>${formatDateTime(user.last_login_at)}</td>
        <td>${user.todos_open}</td>
        <td>${user.todos_done}</td>
    `;
    const roleTd = document.createElement('td');
    if (viewerIsOwner && !user.is_owner) {
        const label = document.createElement('label');
        label.className = 'admin-role-toggle';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = user.is_admin;
        checkbox.addEventListener('change', async () => {
            checkbox.disabled = true;
            try {
                await fetch(`${API_URL}/admin/users/${user.id}/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ is_admin: checkbox.checked }),
                });
            } finally {
                checkbox.disabled = false;
            }
        });
        const span = document.createElement('span');
        span.textContent = t('admin.roleAdmin');
        label.appendChild(checkbox);
        label.appendChild(span);
        roleTd.appendChild(label);
    } else {
        roleTd.innerHTML = roleBadgeHtml(user);
    }
    tr.appendChild(roleTd);

    const actionTd = document.createElement('td');
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    return tr;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

async function loadUsers() {
    const meRes = await apiGet('/me');
    if (meRes.status === 401) {
        showMessage(`${t('admin.notLoggedIn')} <a href="/">${t('admin.notLoggedInLink')}</a>`);
        return;
    }
    const me = await meRes.json();

    const usersRes = await apiGet('/admin/users');
    if (usersRes.status === 403) {
        showMessage(t('admin.noAccess'));
        return;
    }
    if (!usersRes.ok) {
        showMessage(t('admin.noAccess'));
        return;
    }
    const users = await usersRes.json();

    tableBody.innerHTML = '';
    users.forEach((u) => tableBody.appendChild(renderRow(u, !!me.is_owner)));

    messageEl.classList.add('hidden');
    tableWrap.classList.remove('hidden');
}

initI18n();

if (!token) {
    showMessage(`${t('admin.notLoggedIn')} <a href="/">${t('admin.notLoggedInLink')}</a>`);
} else {
    loadUsers();
}
