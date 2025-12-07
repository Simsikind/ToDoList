const API_URL = 'http://localhost:8000';

// State
let token = localStorage.getItem('access_token');
let allTodos = []; // Store all fetched todos for client-side filtering

// DOM Elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const todoForm = document.getElementById('todo-form');
const todoList = document.getElementById('todo-list');
const logoutBtn = document.getElementById('logout-btn');
const authMessage = document.getElementById('auth-message');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');

// Filter Elements
const filterPriority = document.getElementById('filter-priority');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const sortBySelect = document.getElementById('sort-by');
const clearFiltersBtn = document.getElementById('clear-filters');

// Modal Elements
const todoModal = document.getElementById('todo-modal');
const openModalBtn = document.getElementById('open-todo-modal');
const closeModalBtn = document.getElementById('close-modal');

// Init
function init() {
    if (token) {
        showApp();
    } else {
        showLogin();
    }
    
    // Attach filter listeners
    filterPriority.addEventListener('change', applyFilters);
    filterDateFrom.addEventListener('change', applyFilters);
    filterDateTo.addEventListener('change', applyFilters);
    sortBySelect.addEventListener('change', applyFilters);
    
    clearFiltersBtn.addEventListener('click', () => {
        filterPriority.value = 'all';
        filterDateFrom.value = '';
        filterDateTo.value = '';
        sortBySelect.value = 'created';
        applyFilters();
    });

    // Modal Listeners
    openModalBtn.addEventListener('click', () => {
        todoModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        todoModal.classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        if (e.target === todoModal) {
            todoModal.classList.add('hidden');
        }
    });
}

// Navigation
function showLogin() {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    authMessage.textContent = '';
}

function showApp() {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
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

logoutBtn.addEventListener('click', () => {
    token = null;
    localStorage.removeItem('access_token');
    showLogin();
});

// Auth Actions
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginForm.username.value;
    const password = loginForm.password.value;

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) throw new Error('Login failed');

        const data = await res.json();
        token = data.access_token;
        localStorage.setItem('access_token', token);
        loginForm.reset();
        showApp();
    } catch (err) {
        authMessage.textContent = 'Login failed. Check credentials.';
        authMessage.style.color = 'red';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = registerForm.username.value;
    const password = registerForm.password.value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || 'Registration failed');
        }

        authMessage.textContent = 'Registration successful! Please login.';
        authMessage.style.color = 'green';
        registerForm.reset();
        showLoginBtn.click();
    } catch (err) {
        authMessage.textContent = err.message;
        authMessage.style.color = 'red';
    }
});

// Todo Actions
async function fetchTodos() {
    try {
        const res = await fetch(`${API_URL}/todos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401) {
            logoutBtn.click();
            return;
        }

        const todos = await res.json();
        allTodos = todos; // Save to state
        applyFilters();   // Render with current filters
    } catch (err) {
        console.error('Error fetching todos:', err);
    }
}

function applyFilters() {
    const priorityVal = filterPriority.value;
    const dateFromVal = filterDateFrom.value;
    const dateToVal = filterDateTo.value;
    const sortByVal = sortBySelect.value;

    let filtered = [...allTodos]; // Copy array to avoid mutating original order

    // Filter by Priority
    if (priorityVal !== 'all') {
        filtered = filtered.filter(t => t.priority === parseInt(priorityVal));
    }

    // Filter by Date From
    if (dateFromVal) {
        const fromDate = new Date(dateFromVal);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(t => {
            if (!t.due_date) return false;
            const tDate = new Date(t.due_date);
            tDate.setHours(0, 0, 0, 0);
            return tDate >= fromDate;
        });
    }

    // Filter by Date To
    if (dateToVal) {
        const toDate = new Date(dateToVal);
        toDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(t => {
            if (!t.due_date) return false;
            const tDate = new Date(t.due_date);
            tDate.setHours(0, 0, 0, 0);
            return tDate <= toDate;
        });
    }

    // Sorting
    filtered.sort((a, b) => {
        if (sortByVal === 'priority') {
            // High priority (2) first, then 1, then 0
            return b.priority - a.priority;
        } else if (sortByVal === 'dueDate') {
            // Earliest date first. Null dates at the end.
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        } else {
            // Default: Created (by ID assuming auto-increment)
            return a.id - b.id;
        }
    });

    renderTodos(filtered);
}

todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoForm.title.value;
    const priority = parseInt(todoForm.priority.value);
    const dueDate = todoForm.dueDate.value || null;
    const remindFrom = todoForm.remindFrom.value || null;

    const newTodo = {
        title,
        priority,
        due_date: dueDate,
        remind_from: remindFrom,
        done: false
    };

    try {
        const res = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newTodo)
        });

        if (res.ok) {
            todoForm.reset();
            todoModal.classList.add('hidden'); // Close modal on success
            fetchTodos();
        }
    } catch (err) {
        console.error('Error creating todo:', err);
    }
});

async function toggleTodo(id, currentDone, currentTitle, currentPriority, currentDueDate, currentRemindFrom) {
    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: currentTitle,
                priority: currentPriority,
                due_date: currentDueDate,
                remind_from: currentRemindFrom,
                done: !currentDone
            })
        });

        if (res.ok) fetchTodos();
    } catch (err) {
        console.error('Error toggling todo:', err);
    }
}

async function deleteTodo(id) {
    if (!confirm('Delete this todo?')) return;

    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) fetchTodos();
    } catch (err) {
        console.error('Error deleting todo:', err);
    }
}

// Rendering
function formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let result = `${day}.${month}.${year}`;
    
    if (includeTime) {
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        result += ` ${hours}:${minutes}`;
    }
    
    return result;
}

function renderTodos(todos) {
    todoList.innerHTML = '';
    todos.forEach(todo => {
        const li = document.createElement('li');
        
        let priorityClass = 'priority-low';
        if (todo.priority >= 2) priorityClass = 'priority-high';
        else if (todo.priority === 1) priorityClass = 'priority-medium';

        li.className = `todo-item ${priorityClass} ${todo.done ? 'done' : ''}`;

        li.innerHTML = `
            <div style="display:flex; align-items:center;">
                <input type="checkbox" ${todo.done ? 'checked' : ''} 
                    onchange="toggleTodo(${todo.id}, ${todo.done}, '${todo.title.replace(/'/g, "\\'")}', ${todo.priority}, ${todo.due_date ? `'${todo.due_date}'` : 'null'}, ${todo.remind_from ? `'${todo.remind_from}'` : 'null'})">
                <span class="priority-badge">${todo.priority}</span>
                <span class="title" style="margin-left: 10px;">${todo.title}</span>
                ${todo.due_date ? `<small style="margin-left:10px; color:#666;">(Due: ${formatDate(todo.due_date)})</small>` : ''}
                ${todo.remind_from ? `<small style="margin-left:10px; color:#007bff;">(Remind: ${formatDate(todo.remind_from, true)})</small>` : ''}
            </div>
            <div class="todo-actions">
                <button class="danger" onclick="deleteTodo(${todo.id})" ${!todo.done ? 'disabled title="Complete task to delete"' : ''}>Delete</button>
            </div>
        `;
        todoList.appendChild(li);
    });
}

// Start
init();
