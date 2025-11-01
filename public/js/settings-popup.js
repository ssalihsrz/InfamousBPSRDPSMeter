// Settings Popup - Standalone Script
// This runs in the separate settings popup window

// Settings object
const SETTINGS = {
    highlightLocal: true,
    refreshInterval: 0.5,
    rememberNames: true,
    autoClearOnZoneChange: true,
    keepDataAfterDungeon: true,
    defaultSort: 'totalDmg',
    autoUpdate: 'notify', // auto | notify | disable
    overlayOpacity: 1.0,
    columnsCompact: {
        dps: true,
        maxDps: true,
        avgDps: false,
        totalDmg: true,
        hps: true,
        dmgTaken: false,
        gs: false
    },
    columnsFull: {
        dps: true,
        maxDps: true,
        avgDps: true,
        totalDmg: true,
        hps: true,
        dmgTaken: true,
        gs: true
    },
    
    async load() {
        console.log('⚙️ Loading settings from AppData...');
        try {
            const res = await fetch('http://localhost:8989/api/settings/load');
            const data = await res.json();
            if (data.code === 0 && data.settings) {
                console.log('📥 Received from backend:', JSON.stringify(data.settings, null, 2));
                console.log(`🔍 autoUpdate from backend: "${data.settings.autoUpdate}"`);
                
                // Merge loaded settings
                Object.keys(data.settings).forEach(key => {
                    if (key !== 'load' && key !== 'save') {
                        this[key] = data.settings[key];
                    }
                });
                
                console.log(`✅ Settings loaded - autoUpdate is now: "${this.autoUpdate}"`);
                return true;
            }
        } catch (err) {
            console.log('⚠️ Could not load from AppData, using defaults');
        }
        return false;
    },
    
    async save() {
        console.log('💾 Saving settings...');
        
        // Save to AppData
        const settingsToSave = {};
        Object.keys(this).forEach(key => {
            if (typeof this[key] !== 'function') {
                settingsToSave[key] = this[key];
            }
        });
        
        console.log('📤 Sending to backend:', JSON.stringify(settingsToSave, null, 2));
        console.log(`🔍 autoUpdate in payload: "${settingsToSave.autoUpdate}"`);
        
        try {
            // Save to AppData
            const response1 = await fetch('http://localhost:8989/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave)
            });
            
            // Also sync to global settings
            const response2 = await fetch('http://localhost:8989/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsToSave)
            });
            
            if (response1.ok && response2.ok) {
                console.log('✅ Settings saved to both locations');
                showToast('✅ Settings saved successfully!', 'success');
            } else {
                throw new Error('Failed to save to one or more locations');
            }
        } catch (err) {
            console.error('❌ Save failed:', err);
            showToast('❌ Failed to save settings', 'error');
        }
    }
};

// Toast notification with type support
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    
    // Color based on type
    let bgColor = '#10b981'; // green (success)
    if (type === 'error') bgColor = '#ef4444'; // red
    if (type === 'info') bgColor = '#3b82f6'; // blue
    if (type === 'warning') bgColor = '#f59e0b'; // orange
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: #fff;
        padding: 16px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 99999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        white-space: pre-line;
        max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    console.log(`🍞 Toast: ${message} (${type})`);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Load settings into form
function loadSettingsIntoForm() {
    console.log('📝 Populating form fields...');
    
    // General settings
    document.getElementById('setting-highlight').checked = SETTINGS.highlightLocal;
    document.getElementById('setting-refresh').value = SETTINGS.refreshInterval;
    document.getElementById('setting-remember-names').checked = SETTINGS.rememberNames;
    document.getElementById('setting-auto-clear-zone').checked = SETTINGS.autoClearOnZoneChange;
    document.getElementById('setting-keep-after-dungeon').checked = SETTINGS.keepDataAfterDungeon;
    document.getElementById('setting-default-sort').value = SETTINGS.defaultSort || 'totalDmg';
    
    // Auto-update setting
    const autoUpdateElement = document.getElementById('setting-auto-update');
    if (autoUpdateElement) {
        autoUpdateElement.value = SETTINGS.autoUpdate || 'notify';
    }
    
    // Opacity slider
    const opacitySlider = document.getElementById('setting-overlay-opacity');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider && opacityValue) {
        const currentOpacity = SETTINGS.overlayOpacity || 1.0;
        opacitySlider.value = currentOpacity;
        opacityValue.textContent = Math.round(currentOpacity * 100) + '%';
    }
    
    // Compact mode columns
    document.getElementById('setting-col-compact-dps').checked = SETTINGS.columnsCompact.dps;
    document.getElementById('setting-col-compact-max-dps').checked = SETTINGS.columnsCompact.maxDps;
    document.getElementById('setting-col-compact-avg-dps').checked = SETTINGS.columnsCompact.avgDps;
    document.getElementById('setting-col-compact-total-dmg').checked = SETTINGS.columnsCompact.totalDmg;
    document.getElementById('setting-col-compact-hps').checked = SETTINGS.columnsCompact.hps;
    document.getElementById('setting-col-compact-dmg-taken').checked = SETTINGS.columnsCompact.dmgTaken;
    document.getElementById('setting-col-compact-gs').checked = SETTINGS.columnsCompact.gs;
    
    // Full mode columns
    document.getElementById('setting-col-full-dps').checked = SETTINGS.columnsFull.dps;
    document.getElementById('setting-col-full-max-dps').checked = SETTINGS.columnsFull.maxDps;
    document.getElementById('setting-col-full-avg-dps').checked = SETTINGS.columnsFull.avgDps;
    document.getElementById('setting-col-full-total-dmg').checked = SETTINGS.columnsFull.totalDmg;
    document.getElementById('setting-col-full-hps').checked = SETTINGS.columnsFull.hps;
    document.getElementById('setting-col-full-dmg-taken').checked = SETTINGS.columnsFull.dmgTaken;
    document.getElementById('setting-col-full-gs').checked = SETTINGS.columnsFull.gs;
    
    console.log('✅ Form populated');
}

// Tab switching
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎨 Settings popup initializing...');
    
    // Load settings first
    await SETTINGS.load();
    loadSettingsIntoForm();
    
    // Setup tab switching
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active panel
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            document.querySelector(`[data-panel="${tabName}"]`).classList.add('active');
        });
    });
    
    // Opacity slider
    const opacitySlider = document.getElementById('setting-overlay-opacity');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            opacityValue.textContent = Math.round(value * 100) + '%';
        });
    }
    
    // Save button
    document.getElementById('save-settings').addEventListener('click', () => {
        console.log('💾 Save button clicked');
        
        // General settings
        SETTINGS.highlightLocal = document.getElementById('setting-highlight').checked;
        SETTINGS.refreshInterval = parseFloat(document.getElementById('setting-refresh').value);
        SETTINGS.rememberNames = document.getElementById('setting-remember-names').checked;
        SETTINGS.autoClearOnZoneChange = document.getElementById('setting-auto-clear-zone').checked;
        SETTINGS.keepDataAfterDungeon = document.getElementById('setting-keep-after-dungeon').checked;
        SETTINGS.defaultSort = document.getElementById('setting-default-sort').value;
        
        // CRITICAL: Auto-update setting
        const autoUpdateSelect = document.getElementById('setting-auto-update');
        const autoUpdateValue = autoUpdateSelect ? autoUpdateSelect.value : 'notify';
        SETTINGS.autoUpdate = autoUpdateValue;
        console.log(`🔄 Saving autoUpdate: "${autoUpdateValue}" (was: "${SETTINGS.autoUpdate}")`);
        
        SETTINGS.overlayOpacity = parseFloat(document.getElementById('setting-overlay-opacity').value);
        
        // Compact columns
        SETTINGS.columnsCompact.dps = document.getElementById('setting-col-compact-dps').checked;
        SETTINGS.columnsCompact.maxDps = document.getElementById('setting-col-compact-max-dps').checked;
        SETTINGS.columnsCompact.avgDps = document.getElementById('setting-col-compact-avg-dps').checked;
        SETTINGS.columnsCompact.totalDmg = document.getElementById('setting-col-compact-total-dmg').checked;
        SETTINGS.columnsCompact.hps = document.getElementById('setting-col-compact-hps').checked;
        SETTINGS.columnsCompact.dmgTaken = document.getElementById('setting-col-compact-dmg-taken').checked;
        SETTINGS.columnsCompact.gs = document.getElementById('setting-col-compact-gs').checked;
        
        // Full columns
        SETTINGS.columnsFull.dps = document.getElementById('setting-col-full-dps').checked;
        SETTINGS.columnsFull.maxDps = document.getElementById('setting-col-full-max-dps').checked;
        SETTINGS.columnsFull.avgDps = document.getElementById('setting-col-full-avg-dps').checked;
        SETTINGS.columnsFull.totalDmg = document.getElementById('setting-col-full-total-dmg').checked;
        SETTINGS.columnsFull.hps = document.getElementById('setting-col-full-hps').checked;
        SETTINGS.columnsFull.dmgTaken = document.getElementById('setting-col-full-dmg-taken').checked;
        SETTINGS.columnsFull.gs = document.getElementById('setting-col-full-gs').checked;
        
        SETTINGS.save();
    });
    
    // Export Unknown Boss IDs button
    const exportUnknownBtn = document.getElementById('btn-export-unknown-ids');
    if (exportUnknownBtn) {
        exportUnknownBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/mappings/unknown');
                const { code, unknownIds } = await response.json();
                
                if (code !== 0 || !unknownIds) {
                    alert('❌ Failed to fetch unknown IDs from server');
                    return;
                }
                
                const count = Object.keys(unknownIds).length;
                if (count === 0) {
                    alert('✅ No unknown IDs found!\n\nAll encountered bosses/mobs are already in the database.');
                    return;
                }
                
                // Format for GitHub issue
                const formatted = JSON.stringify(unknownIds, null, 2);
                await navigator.clipboard.writeText(formatted);
                
                alert(`✅ Copied ${count} unknown IDs to clipboard!\n\nNext steps:\n1. Go to GitHub Issues\n2. Create new issue using "Boss Mapping" template\n3. Paste the JSON data\n4. Submit to help improve the database!`);
            } catch (err) {
                console.error('Export unknown IDs failed:', err);
                alert('❌ Export failed: ' + err.message);
            }
        });
    }
    
    // Load auto-update setting
    const autoUpdateSelect = document.getElementById('setting-auto-update');
    if (autoUpdateSelect) {
        autoUpdateSelect.value = SETTINGS.autoUpdate || 'notify';
    }
    
    // Setup GLOBAL electron-updater event listeners (if in Electron)
    if (window.electronAPI?.onUpdateDownloaded) {
        console.log('🔌 Setting up global update event listeners...');
        
        // Update available
        window.electronAPI.onUpdateAvailable((info) => {
            console.log('🎉 Global listener: Update available:', info);
            showToast(
                `🎉 Update Available!\n\nCurrent: v${info.currentVersion}\nLatest: v${info.newVersion}`,
                'success'
            );
        });
        
        // Update not available
        window.electronAPI.onUpdateNotAvailable((info) => {
            console.log('✅ Global listener: No update available');
            
            const button = document.getElementById('check-updates-btn');
            if (button) {
                button.disabled = false;
                button.style.background = '';
                button.innerHTML = '<i class="fa-solid fa-check"></i> Up to Date';
                
                // Reset after 3 seconds
                setTimeout(() => {
                    button.innerHTML = '<i class="fa-solid fa-sync"></i> Check for Updates';
                }, 3000);
            }
            
            showToast(
                `✅ You're up to date!\n\nCurrent version: v${info.currentVersion}`,
                'success'
            );
        });
        
        // Download progress
        window.electronAPI.onUpdateDownloadProgress((progress) => {
            console.log(`📥 Global listener: Download progress: ${progress.percent}%`);
            showToast(`Downloading: ${Math.round(progress.percent)}%`, 'info');
        });
        
        // Downloaded
        window.electronAPI.onUpdateDownloaded((info) => {
            console.log('✅ Global listener: Update downloaded:', info.version);
            showToast(
                `✅ Update Downloaded!\n\nVersion ${info.version} ready to install.`,
                'success'
            );
            const result = confirm(
                `✅ Update Downloaded!\n\n` +
                `Version ${info.version} is ready to install.\n\n` +
                `Install now? (App will restart)`
            );
            
            if (result) {
                window.electronAPI.installUpdate();
            }
        });
        
        // Error handler
        window.electronAPI.onUpdateError((error) => {
            console.error('❌ Global listener: Update error:', error);
            showToast(
                `❌ Update failed\n\n${error.message}`,
                'error'
            );
        });
        
        console.log('✅ Global update listeners registered');
    }
    
    console.log('✅ Settings popup ready');
});

// Check for Updates Function - Simplified (uses global listeners)
async function checkForUpdates() {
    console.log('🔄 Manual update check triggered');
    const button = document.getElementById('check-updates-btn');
    
    // Show immediate feedback
    if (button) {
        button.disabled = true;
        button.style.background = 'rgba(59, 130, 246, 0.3)';
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
    }
    
    // Show toast immediately
    showToast('🔍 Checking for updates...', 'info');
    
    // CRITICAL: Reload settings before checking (ensure autoUpdate mode is current)
    await SETTINGS.load();
    console.log(`🔄 Using auto-update mode: ${SETTINGS.autoUpdate}`);
    
    // ELECTRON MODE: Use built-in auto-updater if available
    if (window.electronAPI && window.electronAPI.checkForUpdates) {
        console.log('🔄 Using electron-updater for update check');
        
        // Trigger check (global listeners will handle responses)
        window.electronAPI.checkForUpdates();
        
        // Reset button after timeout (safety net)
        setTimeout(() => {
            if (button && button.disabled) {
                console.log('⏱️ Timeout: Resetting button');
                button.disabled = false;
                button.style.background = '';
                button.innerHTML = '<i class="fa-solid fa-sync"></i> Check for Updates';
            }
        }, 10000);
        
        return;
    }
    
    // BROWSER MODE: Fallback to GitHub API (no auto-install)
    console.log('🌐 Using GitHub API for update check (browser mode)');
    try {
        const response = await fetch('https://api.github.com/repos/ssalihsrz/InfamousBPSRDPSMeter/releases/latest');
        const data = await response.json();
        
        const latestVersion = data.tag_name.replace('v', '');
        const currentVersion = '3.1.196';
        
        if (button) {
            button.innerHTML = '<i class="fa-solid fa-check"></i> Check Complete';
            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-sync"></i> Check for Updates';
            }, 2000);
        }
        
        if (latestVersion > currentVersion) {
            const downloadUrl = `https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases/download/${data.tag_name}/InfamousBPSRDPSMeter-Setup-${latestVersion}.exe`;
            
            const result = confirm(
                `🎉 Update Available!\n\n` +
                `Current: v${currentVersion}\n` +
                `Latest: v${latestVersion}\n\n` +
                `Would you like to download the update?`
            );
            
            if (result) {
                window.open(downloadUrl, '_blank');
            }
        } else {
            alert(`✅ You're up to date!\n\nCurrent version: v${currentVersion}\nLatest version: v${latestVersion}`);
        }
    } catch (error) {
        console.error('Update check failed:', error);
        if (button) {
            button.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Check Failed';
            button.style.background = 'rgba(239, 68, 68, 0.3)';
            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-sync"></i> Check for Updates';
                button.style.background = '';
            }, 2000);
        }
        alert('❌ Failed to check for updates.\n\nPlease check your internet connection and try again.');
    }
}

// Open data folder in file explorer
function openDataFolder() {
    const pathElement = document.getElementById('user-data-path');
    const folderPath = pathElement?.dataset.path;
    
    if (folderPath && window.electronAPI?.openPath) {
        window.electronAPI.openPath(folderPath);
    }
}

// Load user data path
async function loadUserDataPath() {
    try {
        const userDataPath = await window.electronAPI.getUserDataPath();
        const pathElement = document.getElementById('user-data-path');
        if (pathElement) {
            pathElement.textContent = userDataPath;
            pathElement.dataset.path = userDataPath; // Store for openDataFolder
        }
    } catch (error) {
        console.error('Failed to get user data path:', error);
    }
}

// Load path when popup opens
if (window.electronAPI?.getUserDataPath) {
    loadUserDataPath();
}

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
