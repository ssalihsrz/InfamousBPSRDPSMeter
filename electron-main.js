
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec, fork } = require('child_process');
const net = require('net'); // Required for checkPort
const fs = require('fs');
const AutoUpdaterManager = require('./src/auto-updater');

// Function to log to file safely for packaged environment
function logToFile(msg) {
    try {
        const userData = app.getPath('userData');
        const logPath = path.join(userData, 'iniciar_log.txt');
        // Use local time instead of UTC for easier troubleshooting
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            hour12: false 
        }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
        fs.mkdirSync(userData, { recursive: true });
        
        // Log rotation: if file > 5MB, rotate to .old
        if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath);
            if (stats.size > 5 * 1024 * 1024) { // 5 MB limit
                const oldPath = logPath + '.old';
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath); // Delete previous .old file
                }
                fs.renameSync(logPath, oldPath);
            }
        }
        
        fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        // If there's an error, show in console
        console.error('Error writing log:', e);
    }
}


let mainWindow;
let serverProcess;
let server_port = 8989; // Initial port
let isLocked = false; // Initial lock state: unlocked
logToFile('==== ELECTRON START ====');

// Initialize Auto-Updater Manager
const updaterManager = new AutoUpdaterManager(app, logToFile);

    // Function to check if a port is in use
    const checkPort = (port) => {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close(() => resolve(true));
            });
            server.listen(port);
        });
    };

    async function findAvailablePort() {
        let port = 8989;
        while (true) {
            if (await checkPort(port)) {
                return port;
            }
            console.warn(`Port ${port} is already in use, trying next...`);
            port++;
        }
    }

    // Function to kill the process using a specific port
    async function killProcessUsingPort(port) {
        return new Promise((resolve) => {
            exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
                if (stdout) {
                    const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
                    if (lines.length > 0) {
                        const pid = lines[0].trim().split(/\s+/).pop();
                        if (pid) {
                            console.log(`Killing process ${pid} using port ${port}...`);
                            exec(`taskkill /PID ${pid} /F`, (killError, killStdout, killStderr) => {
                                if (killError) {
                                    console.error(`Error killing process ${pid}: ${killError.message}`);
                                } else {
                                    console.log(`Process ${pid} killed successfully.`);
                                }
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    // Helper function to get icon path in both dev and packaged modes
    function getIconPath() {
        if (process.defaultApp || process.env.NODE_ENV === 'development') {
            // Development mode
            return path.join(__dirname, 'icon.ico');
        } else {
            // Packaged mode: icon.ico is in app.asar
            return path.join(process.resourcesPath, 'app.asar', 'icon.ico');
        }
    }

    async function createWindow() {
        logToFile('Attempting to kill processes on port 8989...');
        await killProcessUsingPort(8989);

        mainWindow = new BrowserWindow({
            width: 960,
            height: 500,
            minWidth: 900,
            minHeight: 300,
            maxWidth: 1600,
            maxHeight: 1200,
            frame: false,
            transparent: false,
            resizable: true,  // ENABLE manual resize
            backgroundColor: '#1a1d29',  // Match app background color
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                sandbox: true,
                cache: false // CRITICAL: Disable cache to always load fresh JS
            },
            icon: getIconPath(),
        });
        
        // Clear Electron cache on startup (reduced to avoid choppy UI)
        // Only clear on first launch or version change to avoid performance hit
        await mainWindow.webContents.session.clearCache();
        // REMOVED: User resize tracking - was causing window lock issues
        
        // Add Content Security Policy
        mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; " +
                        "script-src 'self' 'unsafe-inline'; " +
                        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
                        "font-src 'self' https://cdnjs.cloudflare.com; " +
                        "img-src 'self' data: https:; " +
                        "connect-src 'self' ws://localhost:* http://localhost:* https://api.github.com;"
                    ]
                }
            });
        });

        // Configure window to always stay on top with maximum priority
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        
        // Don't use click-through - we'll resize window to match content instead
        mainWindow.setIgnoreMouseEvents(false);

        // Open external links in system browser, not in-app
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            // Only open external URLs in browser
            if (url.startsWith('http://') || url.startsWith('https://')) {
                shell.openExternal(url);
                logToFile(`Opening external link in browser: ${url}`);
            }
            return { action: 'deny' }; // Prevent opening in app
        });

        // Start the Node.js server, passing the port as argument

        // Determine absolute path to server.js based on environment
        let serverPath, nodePath;
        if (process.defaultApp || process.env.NODE_ENV === 'development') {
            // Development mode
            serverPath = path.join(__dirname, 'server.js');
            nodePath = path.join(__dirname, 'node_modules');
        } else {
            // Packaged mode: server.js is in resources/app folder
            serverPath = path.join(process.resourcesPath, 'app', 'server.js');
            // node_modules is in app.asar
            nodePath = path.join(app.getAppPath(), 'node_modules');
        }
        const userData = app.getPath('userData');
        logToFile('Launching server.js on port ' + server_port + ' with path: ' + serverPath);
        logToFile('Node modules path: ' + nodePath);
        logToFile('User data directory: ' + userData);

        // Use fork to launch the server as child process, passing port, userData, and node_modules path
        const { fork } = require('child_process');
        const serverWorkingDir = process.defaultApp || process.env.NODE_ENV === 'development' 
            ? __dirname 
            : path.join(process.resourcesPath, 'app');
        
        // Set NODE_PATH to include both asar and unpacked node_modules
        const env = Object.assign({}, process.env);
        env.NODE_PATH = nodePath + path.delimiter + path.join(app.getAppPath(), 'node_modules');
        
        serverProcess = fork(serverPath, [server_port, userData], {
            cwd: serverWorkingDir, // Set working directory to app folder
            env: env, // Include NODE_PATH
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            execArgv: []
        });

        // Variables to control server startup
        if (typeof createWindow.serverLoaded === 'undefined') createWindow.serverLoaded = false;
        if (typeof createWindow.serverTimeout === 'undefined') createWindow.serverTimeout = null;
        createWindow.serverLoaded = false;
        createWindow.serverTimeout = setTimeout(() => {
            if (!createWindow.serverLoaded) {
                logToFile('ERROR: Server did not respond in 30 seconds. Check if Npcap is installed and running.');
                const logPath = path.join(app.getPath('userData'), 'iniciar_log.txt');
                mainWindow.loadURL(`data:text/html,<div style="padding:40px;font-family:Arial;background:#1a1a1a;color:#fff;height:100vh;">
                    <h1 style="color:#ef4444;">⚠️ Server Startup Failed</h1>
                    <p style="font-size:16px;line-height:1.6;">The backend server did not start within 30 seconds.</p>
                    <h3 style="color:#f59e0b;margin-top:30px;">Common Causes:</h3>
                    <ol style="font-size:14px;line-height:1.8;">
                        <li><strong>Npcap not installed</strong> - Download from <a href="https://npcap.com/" style="color:#3b82f6;">npcap.com</a></li>
                        <li><strong>Npcap service not running</strong> - Run restart-npcap.bat as Administrator</li>
                        <li><strong>Missing Administrator rights</strong> - Right-click app → Run as Administrator</li>
                        <li><strong>Port 8989 blocked</strong> - Check firewall settings</li>
                    </ol>
                    <h3 style="color:#10b981;margin-top:30px;">📝 Check Log File:</h3>
                    <p style="font-size:14px;background:#2d2d2d;padding:15px;border-radius:8px;font-family:monospace;">${logPath}</p>
                    <p style="font-size:12px;color:#9ca3af;margin-top:30px;">Close this window and try again after fixing the issue above.</p>
                </div>`);
            }
        }, 30000); // 30 seconds timeout (increased from 10)

        serverProcess.stdout.on('data', (data) => {
            logToFile('server stdout: ' + data);
            const match = data.toString().match(/Web server started on (http:\/\/localhost:\d+)/);
            if (match && match[1]) {
                const serverUrl = match[1];
                logToFile('Loading URL in window: ' + serverUrl + '/index.html');
                mainWindow.loadURL(`${serverUrl}/index.html`);
                createWindow.serverLoaded = true;
                clearTimeout(createWindow.serverTimeout);
                
                // Show window once content is ready to load
                mainWindow.once('ready-to-show', () => {
                    logToFile('Window shown');
                    mainWindow.show();
                    
                    // Initialize auto-updater after window is shown
                    updaterManager.setMainWindow(mainWindow);
                    
                    // Check for updates 5 seconds after launch (non-intrusive)
                    setTimeout(() => {
                        updaterManager.checkForUpdates().catch(err => {
                            logToFile(`Auto-update check failed (non-critical): ${err.message}`);
                        });
                    }, 5000);
                });
            }
        });

        // FIX: Windows Electron transparency bug - "resize trick"
        // Forces window redraw on focus/blur to prevent title bar appearing
        let resizeTimeout = null;
        
        mainWindow.on('focus', () => {
            // Maintain always-on-top
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setAlwaysOnTop(true, isLocked ? 'screen-saver' : 'normal');
            }
            
            // Resize trick to fix Windows transparency bug
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // CRITICAL: Check if window still exists before resizing
                if (!mainWindow || mainWindow.isDestroyed()) return;
                
                const [width, height] = mainWindow.getSize();
                mainWindow.setSize(width + 1, height);
                setTimeout(() => {
                    // Double-check window still exists
                    if (!mainWindow || mainWindow.isDestroyed()) return;
                    mainWindow.setSize(width, height);
                }, 10);
            }, 50);
        });
        
        mainWindow.on('blur', () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // CRITICAL: Check if window still exists before resizing
                if (!mainWindow || mainWindow.isDestroyed()) return;
                
                const [width, height] = mainWindow.getSize();
                mainWindow.setSize(width + 1, height);
                setTimeout(() => {
                    // Double-check window still exists
                    if (!mainWindow || mainWindow.isDestroyed()) return;
                    mainWindow.setSize(width, height);
                }, 10);
            }, 50);
        });

        // Handle opening external links
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        serverProcess.stderr.on('data', (data) => {
            logToFile('server stderr: ' + data);
        });
        serverProcess.on('close', (code) => {
            logToFile('server process exited with code ' + code);
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
            if (serverProcess) {
                // Send SIGTERM for clean shutdown
                serverProcess.kill('SIGTERM');
                // Force termination if it doesn't close after some time
                setTimeout(() => {
                    if (!serverProcess.killed) {
                        serverProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
        });

    // Handle event to make window movable/unmovable
    ipcMain.on('set-window-movable', (event, movable) => {
        if (mainWindow) {
            mainWindow.setMovable(movable);
        }
    });

    // Handle event to close the window
    ipcMain.on('close-window', () => {
        if (mainWindow) {
            mainWindow.close();
        }
    });

    // Handle event to minimize the window
    ipcMain.on('minimize-window', () => {
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    // Handle event to set always on top
    ipcMain.on('set-always-on-top', (event, alwaysOnTop) => {
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(alwaysOnTop);
            console.log(`Always on Top: ${alwaysOnTop ? 'ON' : 'OFF'}`);
        }
    });

    // Handle event to resize the window
    ipcMain.on('resize-window', (event, width, height) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSize(width, height);
        }
    });

    // PHASE 3: Click-through mode - EXCLUDE title bar so user can click to disable!
    ipcMain.on('set-click-through', (event, enabled) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (enabled) {
                // Enable click-through but allow clicks on title bar (top 50px)
                mainWindow.setIgnoreMouseEvents(true, { forward: true });
            } else {
                // Disable click-through completely
                mainWindow.setIgnoreMouseEvents(false);
            }
        }
    });

    // PHASE 3: Transparency control
    ipcMain.on('set-opacity', (event, opacity) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setOpacity(opacity);
        }
    });
    
    // PHASE 3: Set overlay opacity
    ipcMain.on('set-overlay-opacity', (event, opacity) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setOpacity(opacity);
            logToFile(`🎨 Set overlay opacity: ${opacity}`);
        }
    });

    // Handle events for mouse click-through control
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        if (mainWindow) {
            mainWindow.setIgnoreMouseEvents(ignore, options);
        }
    });

    // Handle window position for manual drag (fallback)
    ipcMain.handle('get-window-position', () => {
        if (mainWindow) {
            return mainWindow.getPosition();
        }
        return [0, 0];
    });

    ipcMain.on('set-window-position', (event, x, y) => {
        if (mainWindow) {
            mainWindow.setPosition(x, y);
        }
    });

    // Handle event to toggle lock state
    ipcMain.on('toggle-lock-state', () => {
        if (mainWindow) {
            isLocked = !isLocked;
            mainWindow.setMovable(!isLocked); // Make window movable or not
            // Don't use setIgnoreMouseEvents here - let CSS/JS handle click-through
            // The renderer will manage mouse event state based on lock status
            mainWindow.webContents.send('lock-state-changed', isLocked); // Notify renderer
            logToFile(`Lock toggled: ${isLocked ? 'Locked' : 'Unlocked'}`);
            console.log(`Lock: ${isLocked ? 'Locked' : 'Unlocked'}`);
        }
    });
    
    // Manual force-unlock handler (emergency fix for stuck window)
    ipcMain.on('force-unlock-window', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            isLocked = false;
            mainWindow.setMovable(true);
            logToFile('⚠️ FORCE UNLOCK - Window was manually unlocked via Ctrl+U');
            console.log('⚠️ FORCE UNLOCK - Window is now movable');
        }
    });

    // Get user data path for log location
    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData');
    });

    // Set window size (for settings modal in compact mode)
    ipcMain.handle('set-window-size', (event, width, height) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setSize(width, height, true);
            return { success: true };
        }
        return { success: false };
    });

    // IPC Handler: Set zoom factor (proper window zoom, not CSS transform)
    ipcMain.on('set-zoom-factor', (event, factor) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.setZoomFactor(factor);
            logToFile(`✨ Zoom factor set to: ${factor} (${factor * 100}%)`);
        }
    });

    // IPC Handler: Set minimum/maximum size (for compact vs full mode)
    ipcMain.handle('set-compact-mode', (event, isCompact) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (isCompact) {
                // Compact mode: 450px width
                mainWindow.setMinimumSize(450, 200);
                mainWindow.setMaximumSize(450, 1200);
                mainWindow.setSize(450, 400, true);
                logToFile('Window set to compact mode: 450px');
            } else {
                // Full mode: 960px width
                mainWindow.setMinimumSize(900, 300);
                mainWindow.setMaximumSize(1600, 1200);
                mainWindow.setSize(960, 500, true);
                logToFile('Window set to full mode: 960px');
            }
            return { success: true };
        }
        return { success: false };
    });

    // Open folder in file explorer
    ipcMain.on('open-folder', (event, folderPath) => {
        shell.openPath(folderPath);
        logToFile(`Opening folder: ${folderPath}`);
    });

    // Simple periodic check to fix stuck window (if it happens)
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isLocked) {
            if (!mainWindow.isMovable()) {
                mainWindow.setMovable(true);
                logToFile('⚠️ Fixed stuck window');
            }
        }
    }, 1000); // Check every second - less aggressive

    // Send initial lock state to renderer once window is ready
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('lock-state-changed', isLocked);
        
        // DISABLED: Auto-update check disabled per user request to prevent data loss concerns
        // Users can manually check via Settings > Check for Updates button
        // setTimeout(() => {
        //     autoUpdater.checkForUpdates().catch(err => {
        //         logToFile('Failed to check for updates: ' + err);
        //     });
        // }, 5000);
    });

    // IPC handlers for auto-updater with settings integration
    ipcMain.on('open-release-page', () => {
        logToFile('User opening releases page');
        shell.openExternal('https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases/latest');
    });

    ipcMain.on('check-for-updates-manual', async () => {
        logToFile('User manually checking for updates');
        try {
            await updaterManager.checkForUpdates();
        } catch (err) {
            logToFile(`Update check failed: ${err.message}`);
        }
    });

    ipcMain.on('download-update', async () => {
        logToFile('User initiated update download');
        try {
            await updaterManager.downloadUpdate();
        } catch (err) {
            logToFile(`Download failed: ${err.message}`);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-error', {
                    message: 'Failed to download update. Please try again later.'
                });
            }
        }
    });

    ipcMain.on('install-update', () => {
        logToFile('User initiated update install');
        updaterManager.quitAndInstall();
    });

    // CRITICAL FIX: Create actual popup windows for Settings and Session Manager
    let settingsWindow = null;
    let sessionManagerWindow = null;

    ipcMain.on('open-settings-window', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.focus();
            return;
        }

        settingsWindow = new BrowserWindow({
            width: 800,
            height: 600,
            minWidth: 750,
            minHeight: 550,
            frame: false,
            parent: mainWindow,
            modal: false,  // Not modal - can interact with main window
            backgroundColor: '#1e212d',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                cache: false
            },
            icon: getIconPath(),
            show: false  // Don't show until ready
        });

        settingsWindow.loadURL(`http://localhost:${server_port}/settings-popup.html`);
        
        settingsWindow.once('ready-to-show', () => {
            settingsWindow.show();
            logToFile('Settings popup window opened');
        });

        settingsWindow.on('closed', () => {
            settingsWindow = null;
        });
    });

    ipcMain.on('close-settings-window', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        }
    });

    ipcMain.on('open-session-manager-window', () => {
        if (sessionManagerWindow && !sessionManagerWindow.isDestroyed()) {
            sessionManagerWindow.focus();
            return;
        }

        sessionManagerWindow = new BrowserWindow({
            width: 850,
            height: 650,
            minWidth: 800,
            minHeight: 600,
            frame: false,
            parent: mainWindow,
            modal: false,
            backgroundColor: '#1e212d',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                cache: false
            },
            icon: getIconPath(),
            show: false
        });

        sessionManagerWindow.loadURL(`http://localhost:${server_port}/session-manager-popup.html`);
        
        sessionManagerWindow.once('ready-to-show', () => {
            sessionManagerWindow.show();
            logToFile('Session Manager popup window opened');
        });

        sessionManagerWindow.on('closed', () => {
            sessionManagerWindow = null;
        });
    });

    ipcMain.on('close-session-manager-window', () => {
        if (sessionManagerWindow && !sessionManagerWindow.isDestroyed()) {
            sessionManagerWindow.close();
        }
    });
    
    // CRITICAL v3.1.193: Notify main window when sessions are changed
    // This allows dropdown to refresh after retrofit or delete operations
    ipcMain.on('sessions-changed', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('refresh-sessions');
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
