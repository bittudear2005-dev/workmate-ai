// ============================================================
// Workmate â€” Frontend JavaScript
// Connects to the FastAPI backend at http://localhost:8000
// ============================================================

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : window.location.origin;

// â”€â”€â”€ Token Migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Migrate old key 'token' â†’ 'wm_token' so returning users don't see "session expired"
(function migrateToken() {
  const old = localStorage.getItem('token');
  if (old && !localStorage.getItem('wm_token')) {
    localStorage.setItem('wm_token', old);
  }
  // Remove the old key regardless
  localStorage.removeItem('token');
})();

let authToken = localStorage.getItem('wm_token') || null;
let currentUser = null;
let allTasks = [];
let allGoals = [];
let allNotes = [];
let currentNoteView = null;
let currentTaskFilter = 'all';

// =============== API UTILITY ===============

function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  return fetch(`${API_BASE}${endpoint}`, { ...options, headers })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        authToken = null;
        localStorage.removeItem('wm_token');
        document.getElementById('authPage').style.display = '';
        document.getElementById('appContainer').style.display = 'none';
        throw new Error('__SILENT_401__');
      }
      if (!res.ok) throw new Error(data.detail || data.error || `Server error ${res.status}`);
      return data;
    });
}
// =============== TOAST ===============

function toast(message, type = 'info') {
  if (!message || message === '__SILENT_401__') return; // suppress internal errors
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'âœ…', error: 'âŒ', info: 'â„¹ï¸', warning: 'âš ï¸' };
  el.innerHTML = `<span>${icons[type] || 'â„¹ï¸'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// =============== HELPERS ===============

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return 'â€”';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function priorityTag(p) {
  const num = typeof p === 'number' ? p : parseInt(p) || 3;
  const labels = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Urgent' };
  return `<span class="tag tag-priority-${num}">${labels[num] || 'Medium'}</span>`;
}

function priorityTagStr(p) {
  const map = { low: 'low', medium: 'medium', high: 'high' };
  const cls = map[String(p).toLowerCase()] || 'medium';
  return `<span class="tag tag-${cls}">${escapeHtml(p)}</span>`;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// =============== AUTH ===============

function toggleAuthForm() {
  const login = document.getElementById('loginForm');
  const register = document.getElementById('registerForm');
  const sw = document.getElementById('authSwitch');
  const errEl = document.getElementById('authError');
  errEl.classList.remove('visible');

  if (login.style.display !== 'none') {
    login.style.display = 'none';
    register.style.display = 'block';
    sw.innerHTML = 'Already have an account? <a onclick="toggleAuthForm()">Sign In</a>';
  } else {
    login.style.display = 'block';
    register.style.display = 'none';
    sw.innerHTML = 'Don\'t have an account? <a onclick="toggleAuthForm()">Sign Up</a>';
  }
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.add('visible');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'â³ Signing in...';
  btn.disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    authToken = data.access_token;
    localStorage.setItem('wm_token', authToken);
    currentUser = data.user;
    enterApp();
    toast('Welcome back! ðŸŽ‰', 'success');
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.textContent = 'ðŸ” Sign In';
    btn.disabled = false;
  }
  return false;
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const full_name = document.getElementById('regName').value.trim();
  const btn = document.getElementById('registerBtn');
  btn.textContent = 'â³ Creating...';
  btn.disabled = true;
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name })
    });
    authToken = data.access_token;
    localStorage.setItem('wm_token', authToken);
    currentUser = data.user;
    enterApp();
    toast('Account created! ðŸš€ Welcome aboard!', 'success');
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.textContent = 'ðŸš€ Create Account';
    btn.disabled = false;
  }
  return false;
}

function logout() {
  authToken = null;
  currentUser = null;
  allTasks = []; allGoals = []; allNotes = [];
  localStorage.removeItem('wm_token');
  document.getElementById('authPage').style.display = '';
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('authError').classList.remove('visible');
  toast('Signed out successfully', 'info');
}

// =============== APP INIT ===============

async function enterApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('appContainer').style.display = 'flex';

  // Set date on dashboard
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const el = document.getElementById('dashDate');
  if (el) el.textContent = dateStr;

  // Greet user by time
  const hour = now.getHours();
  let greet = hour < 12 ? 'â˜€ï¸ Good morning' : hour < 17 ? 'ðŸ‘‹ Good afternoon' : 'ðŸŒ™ Good evening';

  try {
    const meData = await api('/api/auth/me');
    currentUser = meData.user;
    const name = currentUser.full_name || currentUser.username || 'there';
    document.getElementById('userName').textContent = name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userAvatar').textContent = name[0].toUpperCase();
    const greetEl = document.getElementById('dashGreeting');
    if (greetEl) greetEl.textContent = `${greet}, ${name.split(' ')[0]}!`;

    // Stats from /me
    document.getElementById('statTasks').textContent = meData.stats?.total_tasks ?? 'â€“';
    document.getElementById('statGoals').textContent = meData.stats?.total_goals ?? 'â€“';
    document.getElementById('statNotes').textContent = meData.stats?.total_notes ?? 'â€“';
  } catch (err) {
    console.warn('Could not fetch user info:', err);
  }

  // Load all data
  loadTasks();
  loadGoals();
  loadNotes();
}

// Check if already logged in on page load
window.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    enterApp();
  }
});

// =============== NAVIGATION ===============

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
}

// =============== TASKS ===============

async function loadTasks() {
  try {
    allTasks = await api('/api/tasks');
    if (!Array.isArray(allTasks)) allTasks = [];
    const pending = allTasks.filter(t => !t.completed).length;
    const badge = document.getElementById('taskCount');
    if (badge) badge.textContent = pending > 0 ? pending : '';
    document.getElementById('statTasks').textContent = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    document.getElementById('statCompleted').textContent = completed;
    applyTaskFilters();
    renderRecentTasks(allTasks.slice(0, 5));
  } catch (err) {
    console.error('Tasks load error:', err);
    renderEmptyTasks();
  }
}

function applyTaskFilters() {
  let filtered = allTasks;
  if (currentTaskFilter === 'pending') filtered = allTasks.filter(t => !t.completed);
  else if (currentTaskFilter === 'completed') filtered = allTasks.filter(t => t.completed);

  const catFilter = document.getElementById('taskCategoryFilter')?.value;
  if (catFilter) filtered = filtered.filter(t => t.category === catFilter);

  renderTasks(filtered);
}

function filterTasks(filter, tabEl) {
  currentTaskFilter = filter;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  applyTaskFilters();
}

function renderTasks(tasks) {
  const container = document.getElementById('taskList');
  if (!tasks || !tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">âœ…</span>
        <h3>No tasks here</h3>
        <p>Click "+ New Task" to add one</p>
        <button class="btn btn-primary" onclick="openModal('task')">+ New Task</button>
      </div>`;
    return;
  }
  container.innerHTML = tasks.map(t => `
    <div class="item-card">
      <div class="item-checkbox ${t.completed ? 'checked' : ''}" onclick="toggleTask('${t.id}', ${!t.completed})" title="${t.completed ? 'Mark incomplete' : 'Mark complete'}"></div>
      <div class="item-body">
        <div class="item-title ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          ${priorityTag(t.priority)}
          <span class="tag tag-category">${escapeHtml(t.category || 'General')}</span>
          ${t.deadline ? `<span>ðŸ“… ${formatDate(t.deadline)}</span>` : ''}
          ${t.duration ? `<span>â± ${t.duration}m</span>` : ''}
        </div>
        ${t.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.description)}</div>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditTask('${t.id}')" title="Edit">âœï¸</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')" title="Delete">ðŸ—‘</button>
      </div>
    </div>
  `).join('');
}

function renderEmptyTasks() {
  const container = document.getElementById('taskList');
  if (container) container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">âœ…</span>
      <h3>No tasks yet</h3>
      <p>Click "+ New Task" to get started</p>
      <button class="btn btn-primary" onclick="openModal('task')">+ New Task</button>
    </div>`;
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recentTasks');
  if (!container) return;
  if (!tasks || !tasks.length) {
    container.innerHTML = `<div class="empty-state" style="padding:20px"><p style="font-size:13px">No tasks yet â€” create your first one!</p></div>`;
    return;
  }
  container.innerHTML = tasks.map(t => `
    <div class="item-card" onclick="navigateTo('tasks')" style="cursor:pointer">
      <div class="item-checkbox ${t.completed ? 'checked' : ''}" onclick="event.stopPropagation();toggleTask('${t.id}', ${!t.completed})"></div>
      <div class="item-body">
        <div class="item-title ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          ${priorityTag(t.priority)}
          <span class="tag tag-category">${escapeHtml(t.category || 'General')}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function submitTask(e) {
  e.preventDefault();
  const editId = document.getElementById('taskEditId').value;
  const payload = {
    title: document.getElementById('taskTitle').value.trim(),
    description: document.getElementById('taskDesc').value.trim(),
    priority: parseInt(document.getElementById('taskPriority').value),
    category: document.getElementById('taskCategory').value,
    deadline: document.getElementById('taskDeadline').value || null,
    duration: parseInt(document.getElementById('taskDuration').value) || 60
  };
  const btn = document.getElementById('taskSubmitBtn');
  btn.textContent = editId ? 'â³ Saving...' : 'â³ Creating...';
  btn.disabled = true;
  try {
    if (editId) {
      await api(`/api/tasks/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Task updated! âœ…', 'success');
    } else {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      toast('Task created! âœ…', 'success');
    }
    closeModal('task');
    resetTaskForm();
    loadTasks();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.textContent = editId ? 'Save Changes' : 'Create Task';
    btn.disabled = false;
  }
  return false;
}

function resetTaskForm() {
  document.getElementById('taskEditId').value = '';
  document.getElementById('taskForm').reset();
  document.getElementById('taskPriority').value = '3';
  document.getElementById('taskCategory').value = 'General';
  document.getElementById('taskDuration').value = '60';
  document.getElementById('taskModalTitle').textContent = 'âœ… New Task';
  document.getElementById('taskSubmitBtn').textContent = 'Create Task';
}

function openEditTask(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  document.getElementById('taskEditId').value = task.id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority || 3;
  document.getElementById('taskCategory').value = task.category || 'General';
  document.getElementById('taskDeadline').value = task.deadline ? task.deadline.split('T')[0] : '';
  document.getElementById('taskDuration').value = task.duration || 60;
  document.getElementById('taskModalTitle').textContent = 'âœï¸ Edit Task';
  document.getElementById('taskSubmitBtn').textContent = 'Save Changes';
  openModal('task');
}

async function toggleTask(id, completed) {
  try {
    await api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ completed }) });
    if (completed) toast('Task completed! ðŸŽ‰', 'success');
    loadTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    toast('Task deleted', 'info');
    loadTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function quickAddTask() {
  const input = document.getElementById('quickTaskInput');
  const title = input.value.trim();
  if (!title) return;
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, priority: 3, category: 'General' })
    });
    input.value = '';
    toast(`Task added: "${title}" âœ…`, 'success');
    loadTasks();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// =============== GOALS ===============

async function loadGoals() {
  try {
    allGoals = await api('/api/goals');
    if (!Array.isArray(allGoals)) allGoals = [];
    document.getElementById('statGoals').textContent = allGoals.length;
    applyGoalFilters();
    renderRecentGoals(allGoals.filter(g => !g.completed).slice(0, 3));
  } catch (err) {
    console.error('Goals load error:', err);
    const c = document.getElementById('goalList');
    if (c) c.innerHTML = `<div class="empty-state"><span class="empty-icon">ðŸŽ¯</span><h3>Could not load goals</h3></div>`;
  }
}

function applyGoalFilters() {
  let filtered = allGoals;
  const typeFilter = document.getElementById('goalTypeFilter')?.value;
  if (typeFilter) filtered = filtered.filter(g => g.type === typeFilter);
  renderGoals(filtered);
}

function renderGoals(goals) {
  const container = document.getElementById('goalList');
  if (!container) return;
  if (!goals || !goals.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">ðŸŽ¯</span>
        <h3>No goals yet</h3>
        <p>Set your first goal to start achieving more</p>
        <button class="btn btn-primary" onclick="openModal('goal')">+ New Goal</button>
      </div>`;
    return;
  }
  container.innerHTML = goals.map(g => `
    <div class="item-card">
      <div class="item-checkbox ${g.completed ? 'checked' : ''}" onclick="toggleGoal('${g.id}', ${!g.completed})" title="${g.completed ? 'Mark incomplete' : 'Mark complete'}"></div>
      <div class="item-body">
        <div class="item-title ${g.completed ? 'completed' : ''}">${escapeHtml(g.title || g.text || '')}</div>
        <div class="item-meta">
          ${priorityTagStr(g.priority)}
          <span class="tag tag-type">${escapeHtml(g.type || 'daily')}</span>
          ${g.target_date ? `<span>ðŸ“… ${formatDate(g.target_date)}</span>` : ''}
        </div>
        ${g.description ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escapeHtml(g.description.substring(0,100))}${g.description.length>100?'...':''}</div>` : ''}
        ${typeof g.progress !== 'undefined' ? `
          <div style="margin-top:10px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
              <span>Progress</span><span>${g.progress}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${g.progress}%"></div></div>
          </div>` : ''}
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditGoal('${g.id}')" title="Edit">âœï¸</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGoal('${g.id}')" title="Delete">ðŸ—‘</button>
      </div>
    </div>
  `).join('');
}

function renderRecentGoals(goals) {
  const container = document.getElementById('recentGoals');
  if (!container) return;
  if (!goals || !goals.length) {
    container.innerHTML = `<div class="empty-state" style="padding:20px"><p style="font-size:13px">No active goals â€” set one now!</p></div>`;
    return;
  }
  container.innerHTML = goals.map(g => `
    <div class="item-card" onclick="navigateTo('goals')" style="cursor:pointer">
      <div class="item-checkbox ${g.completed ? 'checked' : ''}"></div>
      <div class="item-body">
        <div class="item-title">${escapeHtml(g.title || g.text || '')}</div>
        <div class="item-meta">
          ${priorityTagStr(g.priority)}
          <span class="tag tag-type">${escapeHtml(g.type || 'daily')}</span>
        </div>
        ${typeof g.progress !== 'undefined' ? `<div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${g.progress}%"></div></div>` : ''}
      </div>
    </div>
  `).join('');
}

async function submitGoal(e) {
  e.preventDefault();
  const editId = document.getElementById('goalEditId').value;
  const payload = {
    title: document.getElementById('goalTitle').value.trim(),
    description: document.getElementById('goalDesc').value.trim(),
    type: document.getElementById('goalType').value,
    priority: document.getElementById('goalPriority').value,
    target_date: document.getElementById('goalTargetDate').value || null,
    progress: editId ? parseInt(document.getElementById('goalProgress').value) || 0 : 0
  };
  const btn = document.getElementById('goalSubmitBtn');
  btn.textContent = 'â³ Saving...';
  btn.disabled = true;
  try {
    if (editId) {
      await api(`/api/goals/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Goal updated! ðŸŽ¯', 'success');
    } else {
      await api('/api/goals', { method: 'POST', body: JSON.stringify(payload) });
      toast('Goal created! ðŸŽ¯', 'success');
    }
    closeModal('goal');
    resetGoalForm();
    loadGoals();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.textContent = editId ? 'Save Changes' : 'Create Goal';
    btn.disabled = false;
  }
  return false;
}

function resetGoalForm() {
  document.getElementById('goalEditId').value = '';
  document.getElementById('goalForm').reset();
  document.getElementById('goalPriority').value = 'medium';
  document.getElementById('goalModalTitle').textContent = 'ðŸŽ¯ New Goal';
  document.getElementById('goalSubmitBtn').textContent = 'Create Goal';
  document.getElementById('goalProgressGroup').style.display = 'none';
  document.getElementById('goalProgressVal').textContent = '0';
  document.getElementById('goalProgress').value = '0';
}

function openEditGoal(id) {
  const goal = allGoals.find(g => g.id === id);
  if (!goal) return;
  document.getElementById('goalEditId').value = goal.id;
  document.getElementById('goalTitle').value = goal.title || goal.text || '';
  document.getElementById('goalDesc').value = goal.description || '';
  document.getElementById('goalType').value = goal.type || 'daily';
  document.getElementById('goalPriority').value = goal.priority || 'medium';
  document.getElementById('goalTargetDate').value = goal.target_date ? goal.target_date.split('T')[0] : '';
  document.getElementById('goalProgress').value = goal.progress || 0;
  document.getElementById('goalProgressVal').textContent = goal.progress || 0;
  document.getElementById('goalProgressGroup').style.display = 'block';
  document.getElementById('goalModalTitle').textContent = 'âœï¸ Edit Goal';
  document.getElementById('goalSubmitBtn').textContent = 'Save Changes';
  openModal('goal');
}

async function toggleGoal(id, completed) {
  try {
    await api(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify({ completed }) });
    if (completed) toast('Goal achieved! ðŸ†', 'success');
    loadGoals();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  try {
    await api(`/api/goals/${id}`, { method: 'DELETE' });
    toast('Goal deleted', 'info');
    loadGoals();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// =============== NOTES ===============

async function loadNotes() {
  try {
    allNotes = await api('/api/notes');
    if (!Array.isArray(allNotes)) allNotes = [];
    document.getElementById('statNotes').textContent = allNotes.length;
    renderNotes(allNotes);
  } catch (err) {
    console.error('Notes load error:', err);
    const c = document.getElementById('noteList');
    if (c) c.innerHTML = `<div class="empty-state"><span class="empty-icon">ðŸ“</span><h3>Could not load notes</h3></div>`;
  }
}

function filterNotesList() {
  const query = document.getElementById('notesSearch').value.toLowerCase();
  const filtered = allNotes.filter(n =>
    n.title.toLowerCase().includes(query) || (n.content || '').toLowerCase().includes(query)
  );
  renderNotes(filtered);
}

function renderNotes(notes) {
  const container = document.getElementById('noteList');
  if (!container) return;
  if (!notes || !notes.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-icon">ðŸ“</span>
        <h3>No notes yet</h3>
        <p>Capture your first idea or thought</p>
        <button class="btn btn-primary" onclick="openModal('note')">+ New Note</button>
      </div>`;
    return;
  }
  container.innerHTML = notes.map(n => `
    <div class="note-card" onclick="viewNote('${n.id}')">
      <div class="note-header">
        <div class="note-title">${escapeHtml(n.title)}</div>
        ${n.is_favorite || n.favorite ? '<span class="note-star">â­</span>' : ''}
      </div>
      <div class="note-preview">${escapeHtml((n.content || '').trim())}</div>
      <div class="note-footer">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="tag tag-category">${escapeHtml(n.category || 'Personal')}</span>
          <span style="font-size:11px;color:var(--text-muted)">${formatDate(n.created_at)}</span>
        </div>
        <div class="note-actions" onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="openEditNote('${n.id}')" title="Edit">âœï¸</button>
          <button class="btn btn-danger btn-sm" onclick="deleteNote('${n.id}')" title="Delete">ðŸ—‘</button>
        </div>
      </div>
    </div>
  `).join('');
}

function viewNote(id) {
  const note = allNotes.find(n => n.id === id);
  if (!note) return;
  currentNoteView = note;
  document.getElementById('noteViewTitle').textContent = note.title;
  document.getElementById('noteViewContent').textContent = note.content || '';
  document.getElementById('noteViewMeta').innerHTML = `
    <span class="tag tag-category">${escapeHtml(note.category || 'Personal')}</span>
    ${note.is_favorite || note.favorite ? '<span class="tag" style="background:rgba(251,191,36,0.2);color:var(--warning)">â­ Favorite</span>' : ''}
    <span style="font-size:12px;color:var(--text-muted)">${formatDate(note.created_at)}</span>
  `;
  document.getElementById('noteViewDate').textContent = `Last updated: ${formatDate(note.updated_at || note.created_at)}`;
  openModal('noteView');
}

function editCurrentNote() {
  if (!currentNoteView) return;
  closeModal('noteView');
  openEditNote(currentNoteView.id);
}

async function submitNote(e) {
  e.preventDefault();
  const editId = document.getElementById('noteEditId').value;
  const payload = {
    title: document.getElementById('noteTitle').value.trim(),
    content: document.getElementById('noteContent').value.trim(),
    category: document.getElementById('noteCategory').value,
    is_favorite: document.getElementById('noteFavorite').checked,
    favorite: document.getElementById('noteFavorite').checked
  };
  const btn = document.getElementById('noteSubmitBtn');
  btn.textContent = 'â³ Saving...';
  btn.disabled = true;
  try {
    if (editId) {
      await api(`/api/notes/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Note updated! ðŸ“', 'success');
    } else {
      await api('/api/notes', { method: 'POST', body: JSON.stringify(payload) });
      toast('Note saved! ðŸ“', 'success');
    }
    closeModal('note');
    resetNoteForm();
    loadNotes();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.textContent = editId ? 'Save Changes' : 'Save Note';
    btn.disabled = false;
  }
  return false;
}

function resetNoteForm() {
  document.getElementById('noteEditId').value = '';
  document.getElementById('noteForm').reset();
  document.getElementById('noteCategory').value = 'Personal';
  document.getElementById('noteFavorite').checked = false;
  document.getElementById('noteModalTitle').textContent = 'ðŸ“ New Note';
  document.getElementById('noteSubmitBtn').textContent = 'Save Note';
}

function openEditNote(id) {
  const note = allNotes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('noteEditId').value = note.id;
  document.getElementById('noteTitle').value = note.title;
  document.getElementById('noteContent').value = note.content || '';
  document.getElementById('noteCategory').value = note.category || 'Personal';
  document.getElementById('noteFavorite').checked = !!(note.is_favorite || note.favorite);
  document.getElementById('noteModalTitle').textContent = 'âœï¸ Edit Note';
  document.getElementById('noteSubmitBtn').textContent = 'Save Changes';
  openModal('note');
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  try {
    await api(`/api/notes/${id}`, { method: 'DELETE' });
    toast('Note deleted', 'info');
    loadNotes();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// =============== AI CHAT ===============

async function sendChat() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  input.style.height = 'auto';

  const model = document.getElementById('aiModelSelect').value || 'gemini';
  const container = document.getElementById('chatMessages');

  // Remove welcome screen if present
  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // User bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = message;
  container.appendChild(userBubble);

  // Typing indicator
  const typingBubble = document.createElement('div');
  typingBubble.className = 'chat-bubble ai typing';
  typingBubble.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  container.appendChild(typingBubble);
  container.scrollTop = container.scrollHeight;

  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const data = await api('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model })
    });
    typingBubble.className = 'chat-bubble ai';
    typingBubble.innerHTML = '';
    // Format response with line breaks
    const responseText = data.response || 'No response received.';
    typingBubble.textContent = responseText;
  } catch (err) {
    typingBubble.className = 'chat-bubble ai';
    typingBubble.innerHTML = `<span style="color:var(--danger)">âš ï¸ ${escapeHtml(err.message)}</span>`;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
  container.scrollTop = container.scrollHeight;
}

function sendSuggestion(text) {
  document.getElementById('chatInput').value = text;
  sendChat();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

function clearChatUI() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">ðŸ¤–</div>
      <h3>Hello! I'm your AI assistant.</h3>
      <p>Ask me anything â€” tasks, goals, writing, brainstorming, and more.</p>
      <div class="chat-suggestions">
        <button class="suggestion-chip" onclick="sendSuggestion('Help me plan my week productively')">ðŸ“… Plan my week</button>
        <button class="suggestion-chip" onclick="sendSuggestion('Give me 5 productivity tips')">ðŸ’¡ Productivity tips</button>
        <button class="suggestion-chip" onclick="sendSuggestion('Help me break down a big goal into smaller steps')">ðŸŽ¯ Break down a goal</button>
        <button class="suggestion-chip" onclick="sendSuggestion('Write a daily motivation quote for me')">âœ¨ Daily motivation</button>
      </div>
    </div>`;
  toast('Chat cleared', 'info');
}

// =============== MODALS ===============

function openModal(type) {
  const modal = document.getElementById(`${type}Modal`);
  if (modal) modal.classList.add('active');
}

function closeModal(type) {
  const modal = document.getElementById(`${type}Modal`);
  if (modal) modal.classList.remove('active');
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});
