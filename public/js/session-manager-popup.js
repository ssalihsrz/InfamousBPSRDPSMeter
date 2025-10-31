// Session Manager Popup - Performance Optimized
// Standalone script for session manager popup window

// ===== PERFORMANCE OPTIMIZATIONS =====
// 1. Event delegation (not inline onclick)
// 2. DocumentFragment for batch DOM updates
// 3. Debounced actions
// 4. Cached DOM queries
// 5. Minimal reflows

// ===== STATE =====
let allSessions = [];
let selectedSessions = new Set();

// ===== CACHED DOM ELEMENTS =====
const DOM = {
    list: null,
    selectAll: null,
    totalCount: null,
    oldNamesCount: null,
    retrofitCount: null,
    
    init() {
        this.list = document.getElementById('sessions-list');
        this.selectAll = document.getElementById('select-all-sessions');
        this.totalCount = document.getElementById('total-sessions-count');
        this.oldNamesCount = document.getElementById('old-names-count');
        this.retrofitCount = document.getElementById('retrofit-count');
    }
};

// ===== UTILITY FUNCTIONS =====
const showToast = (function() {
    // Toast with minimal DOM manipulation
    return function(message, type = 'info', duration = 3000) {
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed;top:10px;right:10px;background:${colors[type]};color:#fff;padding:8px 16px;border-radius:4px;font-size:11px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    };
})();

// Debounce for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Format functions (cached)
const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
};

const formatNumber = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

// Fetch sessions (with error handling)
async function fetchAllSessions() {
    try {
        const response = await fetch('http://localhost:8989/api/sessions/all');
        const data = await response.json();
        return data.code === 0 ? data.sessions : [];
    } catch (error) {
        console.error('❌ Fetch sessions failed:', error);
        showToast('Failed to load sessions', 'error');
        return [];
    }
}

// ===== PERFORMANCE-OPTIMIZED RENDERING =====

// Create session item HTML (compact, minimal)
function createSessionItem(session) {
    const date = new Date(session.timestamp).toLocaleDateString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    const duration = formatDuration(session.duration || 0);
    const icon = session.autoSaved ? 'fa-robot' : 'fa-file-lines';
    const isOld = session.name.includes('Previous Battle') || session.name.includes('Auto-saved');
    const isSelected = selectedSessions.has(session.id);
    
    // Extract map info if available (added in v3.1.144+)
    let mapInfo = '';
    if (session.mapName || session.zoneName) {
        const mapName = session.mapName || session.zoneName || 'Unknown Map';
        mapInfo = `<span class="meta-item" title="Map/Zone"><i class="fa-solid fa-map"></i>${mapName}</span>`;
    }
    
    return `
        <div class="session-item ${isSelected ? 'selected' : ''}" data-session-id="${session.id}">
            <input type="checkbox" class="session-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="session-info">
                <div class="session-title">
                    <i class="fa-solid ${icon} session-icon"></i>
                    ${session.name}
                </div>
                <div class="session-meta">
                    <span class="meta-item"><i class="fa-solid fa-calendar"></i>${date}</span>
                    <span class="meta-item"><i class="fa-solid fa-hourglass"></i>${duration}</span>
                    <span class="meta-item"><i class="fa-solid fa-users"></i>${session.playerCount||0}p</span>
                    <span class="meta-item"><i class="fa-solid fa-fire"></i>${formatNumber(session.totalDps||0)} DPS</span>
                    ${mapInfo}
                </div>
            </div>
            <div class="session-actions">
                <button class="action-btn rename" data-action="rename"><i class="fa-solid fa-pen"></i> Rename</button>
                <button class="action-btn delete" data-action="delete"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
        </div>
    `;
}

// PERFORMANCE: Batch DOM updates with DocumentFragment
function renderSessions(sessions) {
    allSessions = sessions;
    const sorted = sessions.sort((a, b) => b.timestamp - a.timestamp);
    const oldCount = sorted.filter(s => s.name.includes('Previous Battle') || s.name.includes('Auto-saved')).length;
    
    // Update stats (minimal DOM manipulation)
    DOM.totalCount.innerHTML = `<i class="fa-solid fa-database"></i> ${sessions.length} Sessions`;
    DOM.retrofitCount.textContent = oldCount;
    DOM.oldNamesCount.style.display = oldCount > 0 ? 'flex' : 'none';
    
    // PERFORMANCE: Use innerHTML for bulk update (faster than appendChild loop)
    if (sorted.length === 0) {
        DOM.list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No sessions found</p></div>';
        return;
    }
    
    // Batch render - single reflow
    DOM.list.innerHTML = sorted.map(createSessionItem).join('');
    
    console.log(`✅ Rendered ${sorted.length} sessions`);
}

// ===== EVENT HANDLERS (Event Delegation for Performance) =====

// Toggle select all (with state management)
function toggleSelectAll(checked) {
    if (checked) {
        allSessions.forEach(s => selectedSessions.add(s.id));
    } else {
        selectedSessions.clear();
    }
    renderSessions(allSessions);
}

// Handle session item click (checkbox, rename, delete)
function handleSessionClick(e) {
    console.log('🖱️ Session item clicked:', e.target);
    const target = e.target;
    const sessionItem = target.closest('.session-item');
    if (!sessionItem) {
        console.log('⚠️ Not a session item, ignoring');
        return;
    }
    
    const sessionId = sessionItem.dataset.sessionId;
    console.log('📋 Session ID:', sessionId);
    
    // Checkbox click
    if (target.classList.contains('session-checkbox')) {
        if (target.checked) {
            selectedSessions.add(sessionId);
        } else {
            selectedSessions.delete(sessionId);
        }
        sessionItem.classList.toggle('selected', target.checked);
        
        // Update select-all checkbox
        DOM.selectAll.checked = selectedSessions.size === allSessions.length;
        DOM.selectAll.indeterminate = selectedSessions.size > 0 && selectedSessions.size < allSessions.length;
        return;
    }
    
    // Action buttons (rename/delete)
    const action = target.closest('[data-action]')?.dataset.action;
    console.log('🎬 Action detected:', action);
    if (action === 'rename') {
        console.log('✏️ Calling renameSession');
        renameSession(sessionId);
    } else if (action === 'delete') {
        console.log('🗑️ Calling deleteSingleSession');
        deleteSingleSession(sessionId);
    } else {
        console.log('⚠️ No action matched, action was:', action);
    }
}

// Retrofit old session names
async function retrofitOldSessions() {
    if (!confirm('This will rename all sessions with old names to the new intelligent format. Continue?')) {
        return;
    }
    
    showToast('Retrofitting session names...', 'info', 5000);
    
    try {
        const response = await fetch('http://localhost:8989/api/sessions/retrofit-names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to retrofit sessions');
        
        const data = await response.json();
        showToast(`✅ Retrofitted ${data.updated} sessions!`, 'success');
        
        // Reload sessions in popup
        const sessions = await fetchAllSessions();
        renderSessions(sessions);
        
        // CRITICAL v3.1.193: Notify main window to refresh dropdown
        if (window.electronAPI?.notifySessionsChanged) {
            window.electronAPI.notifySessionsChanged();
        }
        
    } catch (error) {
        console.error('Failed to retrofit sessions:', error);
        showToast('Failed to retrofit sessions', 'error');
    }
}

// PERFORMANCE: Bulk delete using Set (faster than querySelectorAll)
async function bulkDeleteSelected() {
    if (selectedSessions.size === 0) {
        showToast('No sessions selected', 'warning');
        return;
    }
    
    if (!confirm(`Delete ${selectedSessions.size} selected sessions? This cannot be undone.`)) {
        return;
    }
    
    const sessionIds = Array.from(selectedSessions);
    
    try {
        const response = await fetch('http://localhost:8989/api/sessions/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionIds })
        });
        
        if (!response.ok) throw new Error('Failed to delete');
        
        showToast(`✅ Deleted ${sessionIds.length} sessions`, 'success');
        
        // Clear selection and reload
        selectedSessions.clear();
        const sessions = await fetchAllSessions();
        renderSessions(sessions);
        
        // CRITICAL v3.1.193: Notify main window to refresh dropdown
        if (window.electronAPI?.notifySessionsChanged) {
            window.electronAPI.notifySessionsChanged();
        }
        
    } catch (error) {
        console.error('❌ Delete failed:', error);
        showToast('Failed to delete sessions', 'error');
    }
}

// Delete all auto-saved sessions
async function deleteAllAutoSaved() {
    const autoSavedSessions = allSessions.filter(s => s.autoSaved);
    if (autoSavedSessions.length === 0) {
        showToast('No auto-saved sessions to delete', 'info');
        return;
    }
    
    if (!confirm(`Delete all ${autoSavedSessions.length} auto-saved sessions? This cannot be undone.`)) {
        return;
    }
    
    const sessionIds = autoSavedSessions.map(s => s.id);
    
    try {
        const response = await fetch('http://localhost:8989/api/sessions/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionIds })
        });
        
        if (!response.ok) throw new Error('Failed to delete sessions');
        
        showToast(`✅ Deleted ${sessionIds.length} auto-saved sessions`, 'success');
        
        // Reload sessions
        const sessions = await fetchAllSessions();
        renderSessions(sessions);
        
        // CRITICAL v3.1.193: Notify main window to refresh dropdown
        if (window.electronAPI?.notifySessionsChanged) {
            window.electronAPI.notifySessionsChanged();
        }
        
    } catch (error) {
        console.error('Failed to delete sessions:', error);
        showToast('Failed to delete sessions', 'error');
    }
}

// Rename a single session
async function renameSession(sessionId) {
    const session = allSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newName = prompt('Enter new session name:', session.name);
    if (!newName || newName === session.name) return;
    
    try {
        const response = await fetch('http://localhost:8989/api/sessions/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, newName })
        });
        
        if (!response.ok) throw new Error('Failed to rename session');
        
        showToast('✅ Session renamed', 'success');
        
        // Reload sessions
        const sessions = await fetchAllSessions();
        renderSessions(sessions);
        
    } catch (error) {
        console.error('Failed to rename session:', error);
        showToast('Failed to rename session', 'error');
    }
}

// Delete a single session
async function deleteSingleSession(sessionId) {
    console.log('🚨 deleteSingleSession called with ID:', sessionId);
    if (!confirm('Delete this session? This cannot be undone.')) {
        console.log('❌ User cancelled delete');
        return;
    }
    console.log('✅ User confirmed delete, sending request...');
    
    try {
        const response = await fetch(`http://localhost:8989/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.code !== 0) {
            throw new Error(data.msg || 'Failed to delete session');
        }
        
        showToast('✅ Session deleted', 'success');
        
        // Reload sessions
        const sessions = await fetchAllSessions();
        renderSessions(sessions);
        
        // CRITICAL v3.1.193: Notify main window to refresh dropdown
        if (window.electronAPI?.notifySessionsChanged) {
            window.electronAPI.notifySessionsChanged();
        }
        
    } catch (error) {
        console.error('Failed to delete session:', error);
        showToast(`❌ ${error.message}`, 'error');
    }
}

// ===== INITIALIZATION (Event Delegation Pattern) =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Session Manager initializing...');
    const startTime = performance.now();
    
    // Initialize cached DOM elements
    DOM.init();
    
    // PERFORMANCE: Single event listener on list (event delegation)
    DOM.list.addEventListener('click', handleSessionClick);
    
    // Setup toolbar event listeners
    DOM.selectAll.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    document.getElementById('btn-retrofit').addEventListener('click', retrofitOldSessions);
    document.getElementById('btn-delete-selected').addEventListener('click', bulkDeleteSelected);
    document.getElementById('btn-delete-autosaved').addEventListener('click', deleteAllAutoSaved);
    
    // Load and render sessions
    const sessions = await fetchAllSessions();
    renderSessions(sessions);
    
    const loadTime = (performance.now() - startTime).toFixed(1);
    console.log(`✅ Session Manager ready! (${loadTime}ms)`);
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(style);
