// auth.js — session state and the login/register modal.
// Shares the page's global scope with the other scripts (no bundler/modules
// in this project), same as board.js/ui.js/main.js already do.

let currentUser = null;
let authMode = 'login'; // 'login' | 'register'

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    currentUser = res.ok ? (await res.json()).user : null;
  } catch (e) {
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const el = document.getElementById('authControls');
  if (!el) return;

  if (currentUser) {
    el.innerHTML = `
      <span style="font-size:13px; opacity:0.85; margin-right:4px;">👤 ${escapeHtml(currentUser.username)}</span>
      <button class="btn btn-small btn-secondary" onclick="handleLogout()">Log Out</button>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-small" onclick="showAuthModal('login')">Log In</button>
      <button class="btn btn-small btn-secondary" onclick="showAuthModal('register')">Register</button>
    `;
  }

  // The My Games panel depends entirely on auth state.
  if (typeof onAuthStateChanged === 'function') onAuthStateChanged();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showAuthModal(mode) {
  authMode = mode;
  document.getElementById('authModalTitle').textContent = mode === 'login' ? '🔐 Log In' : '📝 Register';
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Log In' : 'Register';
  document.getElementById('authToggleBtn').textContent =
    mode === 'login' ? "Need an account? Register" : 'Already have an account? Log In';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authUsername').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authModal').classList.add('active');
  document.getElementById('authUsername').focus();
}

function hideAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode() {
  showAuthModal(authMode === 'login' ? 'register' : 'login');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');
  errorEl.style.display = 'none';

  const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Something went wrong.';
      errorEl.style.display = 'block';
      return;
    }

    currentUser = data.user;
    hideAuthModal();
    updateAuthUI();
    setStatus(authMode === 'login' ? `Welcome back, ${currentUser.username}!` : `Account created — welcome, ${currentUser.username}!`, 'success');
  } catch (e) {
    errorEl.textContent = 'Network error — please try again.';
    errorEl.style.display = 'block';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // proceed with local logout regardless
  }
  currentUser = null;
  updateAuthUI();
  setStatus('Logged out', 'success');
}
