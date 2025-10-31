const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    setWindowMovable: (movable) => ipcRenderer.send('set-window-movable', movable),
    closeWindow: () => ipcRenderer.send('close-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.send('set-always-on-top', alwaysOnTop),
    resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
    resizeStart: () => ipcRenderer.send('resize-start'),
    resizeEnd: () => ipcRenderer.send('resize-end'),
    toggleLockState: () => ipcRenderer.send('toggle-lock-state'),
    forceUnlockWindow: () => ipcRenderer.send('force-unlock-window'),
    onLockStateChanged: (callback) => ipcRenderer.on('lock-state-changed', (event, isLocked) => callback(isLocked)),
    setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
    getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
    setWindowPosition: (x, y) => ipcRenderer.send('set-window-position', x, y),
    getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
    openFolder: (folderPath) => ipcRenderer.send('open-folder', folderPath),
    setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
    setCompactMode: (isCompact) => ipcRenderer.invoke('set-compact-mode', isCompact),
    setZoomFactor: (factor) => ipcRenderer.send('set-zoom-factor', factor),
    // PHASE 3: Overlay control APIs
    setClickThrough: (enabled) => ipcRenderer.send('set-click-through', enabled),
    setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
    // CRITICAL FIX: Popup window APIs
    openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
    closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
    openSessionManagerWindow: () => ipcRenderer.send('open-session-manager-window'),
    closeSessionManagerWindow: () => ipcRenderer.send('close-session-manager-window'),
    // Session Manager notifications
    notifySessionsChanged: () => ipcRenderer.send('sessions-changed'),
    onSessionsChanged: (callback) => ipcRenderer.on('refresh-sessions', () => callback()),
    // Auto-updater APIs
    checkForUpdates: () => ipcRenderer.send('check-for-updates-manual'),
    downloadUpdate: () => ipcRenderer.send('download-update'),
    installUpdate: () => ipcRenderer.send('install-update'),
    openReleasePage: () => ipcRenderer.send('open-release-page'),
    // Auto-updater event listeners
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, info) => callback(info)),
    onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
