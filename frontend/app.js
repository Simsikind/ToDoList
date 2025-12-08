const API_URL = '/api';

// State
let token = localStorage.getItem('access_token');
let allTodos = []; // Store all fetched todos for client-side filtering
let currentFilteredTodos = []; // Store currently displayed todos for export

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
const changePwBtn = document.getElementById('change-pw-btn');
const changePwModal = document.getElementById('change-pw-modal');
const closePwModalBtn = document.getElementById('close-pw-modal');
const changePwForm = document.getElementById('change-pw-form');

// Filter Elements
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const sortBySelect = document.getElementById('sort-by');
const clearFiltersBtn = document.getElementById('clear-filters');
const exportFormatSelect = document.getElementById('export-format');
const downloadTodosBtn = document.getElementById('download-todos');

// Modal Elements
const todoModal = document.getElementById('todo-modal');
const openModalBtn = document.getElementById('open-todo-modal');
const closeModalBtn = document.getElementById('close-modal');

// Edit Modal Elements
const editModal = document.getElementById('edit-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const editForm = document.getElementById('edit-form');
const deleteTodoBtn = document.getElementById('delete-todo-btn');

// Alerts Elements
const alertsSection = document.getElementById('alerts-section');
const alertsList = document.getElementById('alerts-list');

// Clock Element
const clockElement = document.getElementById('clock');

// Init
function init() {
    if (token) {
        showApp();
    } else {
        showLogin();
    }

    // Start Reminder Check Loop (every 30 seconds)
    setInterval(checkReminders, 30000);

    // Start Clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Attach filter listeners
    filterStatus.addEventListener('change', applyFilters);
    filterPriority.addEventListener('change', applyFilters);
    filterDateFrom.addEventListener('change', applyFilters);
    filterDateTo.addEventListener('change', applyFilters);
    sortBySelect.addEventListener('change', applyFilters);
    
    clearFiltersBtn.addEventListener('click', () => {
        filterStatus.value = 'all';
        filterPriority.value = 'all';
        filterDateFrom.value = '';
        filterDateTo.value = '';
        sortBySelect.value = 'created';
        applyFilters();
    });

    downloadTodosBtn.addEventListener('click', downloadTodos);

    // Modal Listeners
    openModalBtn.addEventListener('click', () => {
        todoModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        todoModal.classList.add('hidden');
    });

    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    // Change Password Modal Listeners
    changePwBtn.addEventListener('click', () => {
        changePwModal.classList.remove('hidden');
    });

    closePwModalBtn.addEventListener('click', () => {
        changePwModal.classList.add('hidden');
    });

    changePwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = changePwForm.oldPassword.value;
        const newPassword = changePwForm.newPassword.value;

        try {
            const res = await fetch(`${API_URL}/change-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Failed to update password');
            }

            alert('Password updated successfully!');
            changePwModal.classList.add('hidden');
            changePwForm.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    window.addEventListener('click', (e) => {
        if (e.target === todoModal) {
            todoModal.classList.add('hidden');
        }
        if (e.target === editModal) {
            editModal.classList.add('hidden');
        }
        if (e.target === changePwModal) {
            changePwModal.classList.add('hidden');
        }
    });
}

function checkReminders() {
    if (!allTodos || allTodos.length === 0) {
        alertsSection.classList.add('hidden');
        return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const alerts = [];

    allTodos.forEach(todo => {
        if (todo.done) return;

        let isAlert = false;
        let alertType = ''; // 'overdue' or 'reminder'

        // Check Overdue
        if (todo.due_date && todo.due_date < todayStr) {
            isAlert = true;
            alertType = 'Overdue';
        }
        // Check Reminder (only if not already overdue)
        else if (todo.remind_from) {
            const remindTime = new Date(todo.remind_from);
            if (now >= remindTime) {
                isAlert = true;
                alertType = 'Reminder';
            }
        }

        if (isAlert) {
            alerts.push({
                title: todo.title,
                dueDate: todo.due_date,
                type: alertType,
                id: todo.id
            });
        }
    });

    renderAlerts(alerts);
}

function renderAlerts(alerts) {
    if (alerts.length === 0) {
        alertsSection.classList.add('hidden');
        return;
    }

    alertsList.innerHTML = '';
    alerts.forEach(alert => {
        const li = document.createElement('li');
        li.style.marginBottom = '5px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        const dateText = alert.dueDate ? formatDate(alert.dueDate) : 'No Date';
        
        li.innerHTML = `
            <span>
                <strong>${alert.type}:</strong> ${alert.title}
            </span>
            <span style="font-size: 0.9em; color: #666;">
                Due: ${dateText}
            </span>
        `;
        alertsList.appendChild(li);
    });

    alertsSection.classList.remove('hidden');
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
    const creation_password = registerForm.creation_password.value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, creation_password })
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
        checkReminders(); // Update alerts immediately
    } catch (err) {
        console.error('Error fetching todos:', err);
    }
}

function applyFilters() {
    const statusVal = filterStatus.value;
    const priorityVal = filterPriority.value;
    const dateFromVal = filterDateFrom.value;
    const dateToVal = filterDateTo.value;
    const sortByVal = sortBySelect.value;

    let filtered = [...allTodos]; // Copy array to avoid mutating original order

    // Filter by Status
    if (statusVal === 'active') {
        filtered = filtered.filter(t => !t.done);
    } else if (statusVal === 'done') {
        filtered = filtered.filter(t => t.done);
    }

    // Filter by Priority
    if (priorityVal !== 'all') {
        filtered = filtered.filter(t => t.priority === parseInt(priorityVal));
    }

    // Filter by Date From
    if (dateFromVal) {
        filtered = filtered.filter(t => {
            if (!t.due_date) return false;
            return t.due_date >= dateFromVal;
        });
    }

    // Filter by Date To
    if (dateToVal) {
        filtered = filtered.filter(t => {
            if (!t.due_date) return false;
            return t.due_date <= dateToVal;
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
            return a.due_date.localeCompare(b.due_date);
        } else {
            // Default: Created (by ID assuming auto-increment)
            return a.id - b.id;
        }
    });

    currentFilteredTodos = filtered;
    renderTodos(filtered);
}

function downloadTodos() {
    if (!currentFilteredTodos || currentFilteredTodos.length === 0) {
        alert("No tasks to export!");
        return;
    }

    const format = exportFormatSelect.value;
    if (format === 'pos') {
        downloadPos(currentFilteredTodos);
    } else {
        downloadHtml(currentFilteredTodos);
    }
}

function downloadPos(todos) {
    const width = 32;
    const line = '-'.repeat(width);
    const dotted = '- '.repeat(width/2);
    const now = new Date();
    
    let text = "";
    
    // Header
    const title = "ToDo List";
    const padding = Math.floor((width - title.length) / 2);
    text += " ".repeat(padding) + title + "\n";
    text += now.toLocaleString() + "\n";
    text += line + "\n";
    
    todos.forEach(todo => {
        // Status Box & Title
        const box = todo.done ? "[x] " : "[ ] ";
        const fullTitle = box + todo.title;
        
        // Simple word wrap
        const words = fullTitle.split(' ');
        let currentLine = "";
        
        words.forEach(word => {
            if ((currentLine + word).length > width) {
                text += currentLine.trim() + "\n";
                currentLine = "    " + word + " "; // Indent wrapped lines
            } else {
                currentLine += word + " ";
            }
        });
        text += currentLine.trim() + "\n";
        
        // Details
        if (todo.due_date) {
            text += `Due: ${formatDate(todo.due_date)}\n`;
        }
        
        const prio = todo.priority === 2 ? "High" : (todo.priority === 1 ? "Med" : "Low");
        text += `Pri: ${prio}\n`;
        
        text += dotted + "\n";
    });
    
    // Footer
    text += "\n\n\n"; // Feed lines for cutter

    // Open Print Window
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <head>
            <title>POS Print</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 0;
                }
                pre {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 24px;
                    font-weight: bold;
                    color: black;
                    white-space: pre;
                    margin: 0;
                }
                @media print {
                    @page { margin: 0; }
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <pre>${text}</pre>
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    }
                }
            </script>
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
        <title>ToDo List Export</title>
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
        <h1>My ToDo List</h1>
        <p>Exported on: ${dateStr} at ${timeStr}</p>
        <table>
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Title</th>
                    <th>Due Date</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
    `;

    todos.forEach(todo => {
        const status = todo.done ? 'Completed' : 'Active';
        const priorityLabel = todo.priority === 2 ? 'High' : (todo.priority === 1 ? 'Medium' : 'Low');
        const rowClass = todo.done ? 'done' : '';
        const priorityClass = `priority-${todo.priority}`;
        
        htmlContent += `
            <tr class="${rowClass}">
                <td>${status}</td>
                <td class="${priorityClass}">${priorityLabel}</td>
                <td>${todo.title}</td>
                <td>${todo.due_date ? formatDate(todo.due_date) : '-'}</td>
                <td>${todo.description || '-'}</td>
            </tr>
        `;
    });

    htmlContent += `
            </tbody>
        </table>
        <script>window.print();</script>
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
    const title = todoForm.title.value;
    const description = todoForm.description.value || null;
    const priority = parseInt(todoForm.priority.value);
    const dueDate = todoForm.dueDate.value || null;
    const remindFrom = todoForm.remindFrom.value || null;

    const newTodo = {
        title,
        description,
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

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = editForm.id.value;
    const title = editForm.title.value;
    const description = editForm.description.value || null;
    const priority = parseInt(editForm.priority.value);
    const dueDate = editForm.dueDate.value || null;
    const remindFrom = editForm.remindFrom.value || null;
    const done = editForm.done.checked;

    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description,
                priority,
                due_date: dueDate,
                remind_from: remindFrom,
                done: done
            })
        });

        if (res.ok) {
            editModal.classList.add('hidden');
            fetchTodos();
        }
    } catch (err) {
        console.error('Error updating todo:', err);
    }
});

deleteTodoBtn.addEventListener('click', async () => {
    const id = editForm.id.value;
    if (!id) return;
    
    // Check if allowed to delete (optional, based on previous logic)
    // The button might be disabled in openEditModal if not allowed
    if (deleteTodoBtn.disabled) return;

    if (!confirm('Delete this todo?')) return;

    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            editModal.classList.add('hidden');
            fetchTodos();
        }
    } catch (err) {
        console.error('Error deleting todo:', err);
    }
});

async function toggleTodo(id, currentDone, currentTitle, currentPriority, currentDueDate, currentRemindFrom, currentDescription) {
    try {
        const res = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: currentTitle,
                description: currentDescription,
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
    
    // Parse ISO string manually to avoid timezone conversion
    // Format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS...
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    
    let result = `${day}.${month}.${year}`;
    
    if (includeTime && dateStr.includes('T')) {
        const timePart = dateStr.split('T')[1];
        // timePart might be HH:MM:SS or HH:MM:SS.ssssss
        // We just want HH:MM
        const [hours, minutes] = timePart.split(':');
        result += ` ${hours}:${minutes}`;
    }
    
    return result;
}

function openEditModal(id) {
    const todo = allTodos.find(t => t.id === id);
    if (!todo) return;

    editForm.id.value = todo.id;
    editForm.title.value = todo.title;
    editForm.description.value = todo.description || '';
    editForm.priority.value = todo.priority;
    editForm.dueDate.value = todo.due_date || '';
    editForm.done.checked = todo.done;
    
    // datetime-local expects YYYY-MM-DDTHH:MM
    // We use raw string slicing to avoid timezone shifts
    if (todo.remind_from) {
        editForm.remindFrom.value = todo.remind_from.slice(0, 16);
    } else {
        editForm.remindFrom.value = '';
    }

    // Function to update delete button state
    const updateDeleteBtnState = () => {
        if (!editForm.done.checked) {
            deleteTodoBtn.disabled = true;
            deleteTodoBtn.title = "Complete task to delete";
            deleteTodoBtn.style.opacity = "0.5";
            deleteTodoBtn.style.cursor = "not-allowed";
        } else {
            deleteTodoBtn.disabled = false;
            deleteTodoBtn.title = "Delete this task";
            deleteTodoBtn.style.opacity = "1";
            deleteTodoBtn.style.cursor = "pointer";
        }
    };

    // Initial state check
    updateDeleteBtnState();

    // Listen for changes on the checkbox
    editForm.done.onchange = updateDeleteBtnState;

    editModal.classList.remove('hidden');
}

function renderTodos(todos) {
    todoList.innerHTML = '';
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    todos.forEach(todo => {
        const li = document.createElement('li');
        
        let priorityClass = 'priority-low';
        if (todo.priority >= 2) priorityClass = 'priority-high';
        else if (todo.priority === 1) priorityClass = 'priority-medium';

        // Determine Status Classes
        let statusClass = '';
        if (!todo.done) {
            // Check Overdue (Due date < Today)
            if (todo.due_date && todo.due_date < todayStr) {
                statusClass = 'overdue';
            } 
            // Check Reminder (Now >= Remind Time)
            else if (todo.remind_from) {
                const remindTime = new Date(todo.remind_from);
                if (now >= remindTime) {
                    statusClass = 'reminder-active';
                }
            }
        }

        li.className = `todo-item ${priorityClass} ${todo.done ? 'done' : ''} ${statusClass}`;

        li.innerHTML = `
            <div style="display:flex; align-items:center; flex-wrap: wrap;">
                <div style="display:flex; align-items:center; width: 100%;">
                    <input type="checkbox" ${todo.done ? 'checked' : ''} 
                        onchange="toggleTodo(${todo.id}, ${todo.done}, '${todo.title.replace(/'/g, "\\'")}', ${todo.priority}, ${todo.due_date ? `'${todo.due_date}'` : 'null'}, ${todo.remind_from ? `'${todo.remind_from}'` : 'null'}, ${todo.description ? `'${todo.description.replace(/'/g, "\\'").replace(/\n/g, "\\n")}'` : 'null'})">
                    <span class="priority-badge">${todo.priority}</span>
                    <span class="title" style="margin-left: 10px; font-weight: bold;">${todo.title}</span>
                    ${todo.due_date ? `<small style="margin-left:10px; color:#666;">(Due: ${formatDate(todo.due_date)})</small>` : ''}
                    ${todo.remind_from ? `<small style="margin-left:10px; color:#007bff;">(Remind: ${formatDate(todo.remind_from, true)})</small>` : ''}
                </div>
                ${todo.description ? `<div style="width: 100%; margin-left: 30px; margin-top: 5px; color: #555; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">${todo.description}</div>` : ''}
            </div>
            <div class="todo-actions">
                <button class="secondary" onclick="openEditModal(${todo.id})">Edit</button>
            </div>
        `;
        todoList.appendChild(li);
    });
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockElement) {
        clockElement.textContent = `${hours}:${minutes}`;
    }
}

// Start
init();
