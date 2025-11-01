const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs');
const VPNDetector = require('./vpnDetector');

function initializeApi(app, server, io, userDataManager, logger, globalSettings, VERSION = '2.5.1', userDataPath = __dirname, mappingManager = null) {
    // Use userDataPath for all user data (AppData on Windows)
    const SESSIONS_PATH = path.join(userDataPath, 'sessions');
    const SETTINGS_PATH = path.join(userDataPath, 'settings.json');
    const LOGS_DPS_PATH = path.join(userDataPath, 'logs_dps.json');
    
    console.log('🔧 INSIDE initializeApi - STARTING');
    logger.info('🔧 INSIDE initializeApi - STARTING');
    
    // Initialize VPN detector
    const vpnDetector = new VPNDetector(logger);
    
    app.use(cors());
    app.use(express.json({ limit: '50mb' })); // Increased limit for large session saves with skill data
    app.use(express.urlencoded({ limit: '50mb', extended: true })); // Also increase URL-encoded limit
    app.use(express.static(path.join(__dirname, '..', '..', 'public'))); // Ajustar la ruta
    app.use('/tables', express.static(path.join(__dirname, '..', '..', 'tables'))); // Serve tables directory

    app.get('/icon.png', (req, res) => {
        res.sendFile(path.join(__dirname, '..', '..', 'icon.png')); // Ajustar la ruta
    });

    app.get('/favicon.ico', (req, res) => {
        res.sendFile(path.join(__dirname, '..', '..', 'icon.ico')); // Ajustar la ruta
    });

    // Version endpoint
    app.get('/api/version', (req, res) => {
        res.json({
            code: 0,
            version: VERSION,
            timestamp: Date.now()
        });
    });

    app.get('/api/data', (req, res) => {
        // PERFORMANCE: Only return top 30 active players + local + party
        const userData = userDataManager.getActiveUsersData(30);
        const payload = Object.entries(userData).map(([uid, summary]) => ({
            uid: Number(uid),
            ...summary
        }));
        
        // CRITICAL: Check if server changed to force frontend clear
        const serverChanged = userDataManager.checkAndResetServerChange();
        
        res.json({ 
            code: 0, 
            players: payload,
            serverChanged: serverChanged  // Frontend uses this to clear display
        });
    });

    app.get('/api/solo-user', (req, res) => {
        const soloData = userDataManager.getSoloUserData();
        const data = {
            code: 0,
            user: soloData,
            timestamp: Date.now(),
            startTime: userDataManager.startTime
        };
        res.json(data);
    });

    app.get('/api/party-info', (req, res) => {
        const partyMembers = Array.from(userDataManager.partyMembers);
        const raidGroups = {};
        for (const [groupId, members] of userDataManager.raidMembers.entries()) {
            raidGroups[groupId] = Array.from(members);
        }
        res.json({
            code: 0,
            partyMembers: partyMembers,
            raidGroups: raidGroups,
            localPlayerUid: userDataManager.localPlayerUid
        });
    });

    app.get('/api/enemies', (req, res) => {
        const enemiesData = userDataManager.getAllEnemiesData();
        const data = {
            code: 0,
            enemy: enemiesData,
        };
        res.json(data);
    });

    app.get('/api/boss', (req, res) => {
        // Get current boss information from sniffer
        const bossInfo = sniffer ? sniffer.getCurrentBossInfo() : null;
        res.json({
            code: 0,
            boss: bossInfo
        });
    });

    app.get('/api/clear', (req, res) => {
        userDataManager.clearAll(globalSettings); // Pass globalSettings
        console.log('Statistics cleared!');
        res.json({
            code: 0,
            msg: 'Statistics cleared!',
        });
    });

    app.post('/api/clear', (req, res) => {
        userDataManager.clearAll(globalSettings); // Pass globalSettings
        console.log('Statistics cleared!');
        res.json({
            code: 0,
            msg: 'Statistics cleared!',
        });
    });

    app.post('/api/clear-logs', async (req, res) => {
        const logsBaseDir = path.join(__dirname, '..', '..', 'logs'); // Adjust path
        try {
            const files = await fsPromises.readdir(logsBaseDir);
            for (const file of files) {
                const filePath = path.join(logsBaseDir, file);
                await fsPromises.rm(filePath, { recursive: true, force: true });
            }
            if (fs.existsSync(LOGS_DPS_PATH)) {
                await fsPromises.unlink(LOGS_DPS_PATH);
            }
            console.log('All log files and directories have been cleared!');
            res.json({
                code: 0,
                msg: 'All log files and directories have been cleared!',
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('Log directory doesn\'t exist, no logs to clear.');
                res.json({
                    code: 0,
                    msg: 'Log directory doesn\'t exist, no logs to clear.',
                });
            } else {
                logger.error('Failed to clear log files:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to clear log files.',
                    error: error.message,
                });
            }
        }
    });

    app.post('/api/pause', (req, res) => {
        const { paused } = req.body;
        globalSettings.isPaused = paused; // Update pause state in globalSettings
        console.log(`Statistics ${globalSettings.isPaused ? 'paused' : 'resumed'}!`);
        res.json({
            code: 0,
            msg: `Statistics ${globalSettings.isPaused ? 'paused' : 'resumed'}!`,
            paused: globalSettings.isPaused,
        });
    });

    app.get('/api/pause', (req, res) => {
        res.json({
            code: 0,
            paused: globalSettings.isPaused,
        });
    });

    app.post('/api/set-username', (req, res) => {
        const { uid, name } = req.body;
        if (uid && name) {
            const userId = parseInt(uid, 10);
            if (!isNaN(userId)) {
                userDataManager.setName(userId, name);
                console.log(`Manually assigned name '${name}' to UID ${userId}`);
                res.json({ code: 0, msg: 'Username updated successfully.' });
            } else {
                res.status(400).json({ code: 1, msg: 'Invalid UID.' });
            }
        } else {
            res.status(400).json({ code: 1, msg: 'Missing UID or name.' });
        }
    });
    
    // CRITICAL: Save settings to AppData settings.json (PERMANENT STORAGE)
    // File write lock to prevent corruption from simultaneous saves
    let settingsSaveLock = Promise.resolve();
    
    app.post('/api/settings/save', async (req, res) => {
        try {
            const settings = req.body;
            
            // CRITICAL FIX: Direct write (atomic rename causes Windows file locking issues)
            // Add retry logic for EPERM errors
            settingsSaveLock = settingsSaveLock.then(async () => {
                let retries = 3;
                while (retries > 0) {
                    try {
                        await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
                        logger.info('✅ Settings saved to:', SETTINGS_PATH);
                        break;
                    } catch (err) {
                        if (err.code === 'EPERM' && retries > 1) {
                            // Wait 100ms and retry
                            await new Promise(resolve => setTimeout(resolve, 100));
                            retries--;
                        } else {
                            throw err;
                        }
                    }
                }
            });
            
            await settingsSaveLock;
            res.json({ code: 0, msg: 'Settings saved successfully' });
        } catch (error) {
            logger.error('❌ Failed to save settings:', error);
            res.status(500).json({ code: 1, msg: 'Failed to save settings', error: error.message });
        }
    });
    
    // Load settings from AppData settings.json with migration support
    app.get('/api/settings/load', async (req, res) => {
        try {
            const data = await fsPromises.readFile(SETTINGS_PATH, 'utf8');
            let settings = JSON.parse(data);
            
            // MIGRATION: Add new settings with defaults if they don't exist
            // This preserves existing settings while adding new ones from updates
            const defaultSettings = {
                maxSessions: 20,
                autoUpdate: 'notify',
                // Add other new settings here as we add features
            };
            
            let needsMigration = false;
            for (const [key, defaultValue] of Object.entries(defaultSettings)) {
                if (settings[key] === undefined) {
                    settings[key] = defaultValue;
                    needsMigration = true;
                }
            }
            
            // Save migrated settings back to file
            if (needsMigration) {
                await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
                logger.info('✅ Settings migrated with new defaults:', SETTINGS_PATH);
            }
            
            logger.info('✅ Settings loaded from:', SETTINGS_PATH);
            res.json({ code: 0, settings });
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet, return empty settings
                logger.info('ℹ️ No settings.json found, using defaults. Will create on first save.');
                res.json({ code: 0, settings: null });
            } else {
                logger.error('❌ Failed to load settings:', error);
                res.status(500).json({ code: 1, msg: 'Failed to load settings', error: error.message });
            }
        }
    });
    
    // Auto-refresh unknown names endpoint
    app.get('/api/unknown-players', (req, res) => {
        const unknownPlayers = [];
        for (const [uid, user] of userDataManager.users.entries()) {
            if (!user.name || user.name === '') {
                unknownPlayers.push({
                    uid: uid,
                    profession: user.profession,
                    fightPoint: user.fightPoint,
                    totalDamage: user.damageStats.stats.total
                });
            }
        }
        res.json({
            code: 0,
            count: unknownPlayers.length,
            players: unknownPlayers
        });
    });
    
    // Trigger name resolution attempt
    app.post('/api/refresh-names', (req, res) => {
        let refreshedCount = 0;
        for (const [uid, user] of userDataManager.users.entries()) {
            if (!user.name || user.name === '') {
                // Check if name is in cache
                const uidStr = String(uid);
                if (userDataManager.playerMap.has(uidStr)) {
                    const cachedName = userDataManager.playerMap.get(uidStr);
                    user.setName(cachedName);
                    refreshedCount++;
                }
            }
        }
        res.json({
            code: 0,
            msg: `Refreshed ${refreshedCount} player names from cache`,
            count: refreshedCount
        });
    });

    app.get('/api/skill/:uid', (req, res) => {
        const uid = parseInt(req.params.uid);
        
        const skillData = userDataManager.getUserSkillData(uid);
        
        if (!skillData) {
            // Player not found at all - return 404
            return res.status(404).json({
                code: 1,
                msg: 'User not found',
            });
        }

        // Return skill data even if empty - UI will show "No skills used yet"
        const skills = skillData.skills || {};
        const skillCount = Object.keys(skills).length;
        
        if (skillCount === 0) {
            logger.info(`📊 No skills yet for ${skillData.name || 'Unknown'} (UID: ${uid}) - player hasn't used abilities`);
        } else {
            logger.info(`✅ Returning ${skillCount} skills for ${skillData.name || 'Unknown'} (UID: ${uid})`);
        }

        res.json({
            code: 0,
            data: skillData,
        });
    });

    // Advanced analytics endpoints
    app.get('/api/analytics/:uid/timeline', (req, res) => {
        const uid = parseInt(req.params.uid);
        const interval = parseInt(req.query.interval, 10) || 1000;
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        res.json({
            code: 0,
            data: {
                timeline: user.getDamageTimeline(interval),
                combatStartTime: user.combatStartTime,
                currentTime: Date.now()
            }
        });
    });

    app.get('/api/analytics/:uid/buffs', (req, res) => {
        const uid = parseInt(req.params.uid);
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        res.json({ code: 0, data: user.getBuffAnalysis() });
    });

    app.get('/api/analytics/:uid/opener', (req, res) => {
        const uid = parseInt(req.params.uid);
        const windowMs = parseInt(req.query.window, 10) || 30000;
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        res.json({
            code: 0,
            data: {
                sequence: user.getOpenerAnalysis(windowMs),
                windowMs
            }
        });
    });

    app.get('/api/analytics/:uid/rotation', (req, res) => {
        const uid = parseInt(req.params.uid);
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        res.json({
            code: 0,
            data: user.skillSequence
        });
    });

    app.get('/api/analytics/:uid/combat-log', (req, res) => {
        const uid = parseInt(req.params.uid);
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        res.json({
            code: 0,
            data: user.getCombatLog()
        });
    });

    app.get('/api/analytics/:uid/export', (req, res) => {
        const uid = parseInt(req.params.uid);
        const user = userDataManager.users.get(uid);

        if (!user) {
            return res.status(404).json({ code: 1, msg: 'User not found' });
        }

        const exportData = {
            version: '3.0.0',
            generatedAt: new Date().toISOString(),
            player: {
                uid: user.uid,
                name: user.name || `Player_${user.uid}`,
                profession: user.profession,
                subProfession: user.subProfession,
                fightPoint: user.fightPoint
            },
            summary: user.getSummary(),
            timeline: user.getDamageTimeline(),
            buffs: user.getBuffAnalysis(),
            opener: user.getOpenerAnalysis(30000),
            rotation: user.skillSequence,
            combatLog: user.getCombatLog(),
            skills: user.getSkillSummary()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="combat-log-${user.name || uid}-${Date.now()}.json"`);
        res.json(exportData);
    });

    app.get('/api/history/:timestamp/summary', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'summary.json'); // Adjust path

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const summaryData = JSON.parse(data);
            res.json({
                code: 0,
                data: summaryData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History summary file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History summary file not found',
                });
            } else {
                logger.error('Failed to read history summary file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history summary file',
                });
            }
        }
    });

    app.get('/api/history/:timestamp/data', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'allUserData.json'); // Ajustar la ruta

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const userData = JSON.parse(data);
            res.json({
                code: 0,
                user: userData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History data file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History data file not found',
                });
            } else {
                logger.error('Failed to read history data file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to read history data file',
                });
            }
        }
    });

    app.get('/api/history/:timestamp/skill/:uid', async (req, res) => {
        const { timestamp, uid } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'users', `${uid}.json`); // Ajustar la ruta

        try {
            const data = await fsPromises.readFile(historyFilePath, 'utf8');
            const skillData = JSON.parse(data);
            res.json({
                code: 0,
                data: skillData,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History skill file not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History skill file not found',
                });
            } else {
                logger.error('Failed to read history skill file:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load history skill file',
                });
            }
        }
    });

    app.get('/api/history/:timestamp/download', async (req, res) => {
        const { timestamp } = req.params;
        const historyFilePath = path.join('./logs', timestamp, 'fight.log'); // Ajustar la ruta
        res.download(historyFilePath, `fight_${timestamp}.log`);
    });

    app.get('/api/history/list', async (req, res) => {
        try {
            const data = (await fsPromises.readdir('./logs', { withFileTypes: true })) // Ajustar la ruta
                .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
                .map((e) => e.name);
            res.json({
                code: 0,
                data: data,
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('History path not found:', error);
                res.status(404).json({
                    code: 1,
                    msg: 'History path not found',
                });
            } else {
                logger.error('Failed to load history path:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load history path',
                });
            }
        }
    });

    app.get('/api/settings', async (req, res) => {
        res.json({ code: 0, data: globalSettings });
    });

    app.post('/api/settings', async (req, res) => {
        const newSettings = req.body;
        Object.assign(globalSettings, newSettings); // Update globalSettings directly
        
        // CRITICAL FIX: MERGE with existing settings.json instead of overwriting
        // This preserves user preferences that aren't part of globalSettings
        try {
            let existingSettings = {};
            try {
                const data = await fsPromises.readFile(SETTINGS_PATH, 'utf8');
                existingSettings = JSON.parse(data);
            } catch (error) {
                // File doesn't exist yet, use empty object
            }
            
            // Merge: existing settings + new settings (new settings take priority)
            const mergedSettings = { ...existingSettings, ...newSettings };
            await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(mergedSettings, null, 2), 'utf8');
            logger.info('✅ Settings merged and saved to:', SETTINGS_PATH);
        } catch (error) {
            logger.error('❌ Failed to merge settings:', error);
        }
        
        res.json({ code: 0, data: globalSettings });
    });

    app.get('/api/diccionario', async (req, res) => {
        const diccionarioPath = path.join(__dirname, '..', '..', 'diccionario.json'); // Ajustar la ruta
        try {
            const data = await fsPromises.readFile(diccionarioPath, 'utf8');
            if (data.trim() === '') {
                res.json({});
            } else {
                res.json(JSON.parse(data));
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn('diccionario.json not found, returning empty object.');
                res.json({});
            } else {
                logger.error('Failed to read or parse diccionario.json:', error);
                res.status(500).json({ code: 1, msg: 'Failed to load diccionario', error: error.message });
            }
        }
    });

    function guardarLogDps(log) {
        if (!globalSettings.enableDpsLog) return;

        let logs = [];
        if (fs.existsSync(LOGS_DPS_PATH)) {
            logs = JSON.parse(fs.readFileSync(LOGS_DPS_PATH, 'utf8'));
        }
        logs.unshift(log);
        fs.writeFileSync(LOGS_DPS_PATH, JSON.stringify(logs, null, 2));
    }

    app.post('/guardar-log-dps', (req, res) => {
        const log = req.body;
        guardarLogDps(log);
        res.sendStatus(200);
    });

    app.get('/logs-dps', (req, res) => {
        let logs = [];
        if (fs.existsSync(LOGS_DPS_PATH)) {
            logs = JSON.parse(fs.readFileSync(LOGS_DPS_PATH, 'utf8'));
        }
        res.json(logs);
    });

    // Session Management Endpoints
    app.get('/api/sessions', async (req, res) => {
        try {
            // Ensure sessions directory exists
            await fsPromises.mkdir(SESSIONS_PATH, { recursive: true });

            const files = await fsPromises.readdir(SESSIONS_PATH);
            const sessionFiles = files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));

            // Sort by timestamp (newest first) and take top 50
            const sessions = sessionFiles
                .sort((a, b) => parseInt(b) - parseInt(a))
                .slice(0, 50)
                .map(timestamp => {
                    const filePath = path.join(SESSIONS_PATH, `${timestamp}.json`);
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        return {
                            id: timestamp,
                            name: data.name || `Session ${new Date(parseInt(timestamp)).toLocaleString()}`,
                            timestamp: parseInt(timestamp),
                            playerCount: data.players ? data.players.length : 0,
                            totalDps: data.totalDps || 0,
                            autoSaved: data.autoSaved || false
                        };
                    } catch (error) {
                        return {
                            id: timestamp,
                            name: `Session ${new Date(parseInt(timestamp)).toLocaleString()}`,
                            timestamp: parseInt(timestamp),
                            playerCount: 0,
                            totalDps: 0,
                            autoSaved: false
                        };
                    }
                });

            res.json({
                code: 0,
                sessions: sessions
            });
        } catch (error) {
            logger.error('Failed to list sessions:', error);
            res.status(500).json({
                code: 1,
                msg: 'Failed to list sessions',
                error: error.message
            });
        }
    });

    app.post('/api/sessions/save', async (req, res) => {
        try {
            const { name, characterUid, characterName, players: frontendPlayers, timestamp: frontendTimestamp, duration, localPlayerUid } = req.body;
            const timestamp = frontendTimestamp || Date.now();

            logger.info(`📝 Session save requested: "${name}" for character: ${characterName || 'Unknown'}`);

            // CRITICAL FIX: Use player data from frontend (includes skills) instead of live data
            let players = [];
            
            if (frontendPlayers && Array.isArray(frontendPlayers) && frontendPlayers.length > 0) {
                // Use data sent from frontend (includes skill breakdown)
                players = frontendPlayers;
                logger.info(`📊 Using frontend session data: ${players.length} players (with skills)`);
            } else {
                // Fallback: Get current live data from userDataManager
                const userData = userDataManager.getAllUsersData();
                players = await Promise.all(Object.entries(userData).map(async ([uid, summary]) => {
                    const playerData = {
                        uid: Number(uid),
                        ...summary
                    };
                    
                    // Include skill data for saved sessions
                    try {
                        const skillData = userDataManager.getUserSkillData ? userDataManager.getUserSkillData(uid) : null;
                        if (skillData && skillData.skills) {
                            playerData.skills = skillData.skills;
                            playerData.skillsSummary = skillData.skillsSummary || {};
                        }
                    } catch (error) {
                        logger.warn(`⚠️ Could not fetch skills for UID ${uid}: ${error.message}`);
                    }
                    
                    return playerData;
                }));
                logger.info(`📊 Using live data: ${players.length} players`);
            }

            // CRITICAL v3.1.192: Validate actual combat data before saving
            // Only save if local player OR top 5 players have meaningful DPS/HPS
            const hasCombatData = players.some((p, index) => {
                const isLocalPlayer = p.uid === localPlayerUid;
                const isTopFive = index < 5;
                const hasDamage = (p.total_damage?.total || 0) > 0;
                const hasHealing = (p.total_healing?.total || 0) > 0;
                
                return (isLocalPlayer || isTopFive) && (hasDamage || hasHealing);
            });
            
            if (players.length === 0 || !hasCombatData) {
                const totalDamage = players.reduce((sum, p) => sum + ((p.total_damage?.total || 0)), 0);
                logger.warn(`⚠️ Session save rejected: No meaningful combat data (${players.length} players, ${totalDamage} total damage)`);
                return res.json({
                    code: 1,
                    msg: 'No meaningful combat data - local player or top 5 must have DPS/HPS'
                });
            }

            const sessionData = {
                id: timestamp,
                name: name || `Session ${new Date(timestamp).toLocaleString()}`,
                timestamp: timestamp,
                players: players,
                totalDps: players.reduce((sum, p) => sum + (p.total_dps || 0), 0),
                playerCount: players.length,
                duration: duration || (userDataManager.getDuration ? userDataManager.getDuration() : 0),
                autoSaved: name?.includes('Auto-saved') || false, // Detect auto-saves
                characterUid: characterUid || localPlayerUid || null, // Character UID for filtering
                characterName: characterName || 'Unknown' // Character name for display
            };

            // Ensure sessions directory exists
            logger.info(`📁 Sessions directory: ${SESSIONS_PATH}`);
            await fsPromises.mkdir(SESSIONS_PATH, { recursive: true });

            // Save session
            const filePath = path.join(SESSIONS_PATH, `${timestamp}.json`);
            logger.info(`💾 Saving to: ${filePath}`);
            await fsPromises.writeFile(filePath, JSON.stringify(sessionData, null, 2));
            logger.info(`✅ Session saved successfully!`);

            // Clean up old sessions (keep configured max auto-saved, unlimited manual)
            const maxSessions = globalSettings.maxSessions || 20;
            const files = await fsPromises.readdir(SESSIONS_PATH);
            const sessionFiles = files
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(SESSIONS_PATH, file);
                    try {
                        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        return {
                            name: file,
                            timestamp: parseInt(file.replace('.json', '')),
                            autoSaved: data.autoSaved || false
                        };
                    } catch (error) {
                        return null;
                    }
                })
                .filter(file => file !== null)
                .sort((a, b) => b.timestamp - a.timestamp);

            // Keep all manual saves (unlimited), but only last N auto-saved
            const autoSaves = sessionFiles.filter(f => f.autoSaved);

            if (autoSaves.length > maxSessions) {
                const autoFilesToDelete = autoSaves.slice(maxSessions);
                for (const file of autoFilesToDelete) {
                    await fsPromises.unlink(path.join(SESSIONS_PATH, file.name));
                }
                logger.info(`🗑️ Cleaned up ${autoFilesToDelete.length} old auto-saved sessions (keeping last ${maxSessions})`);
            }

            res.json({
                code: 0,
                msg: 'Session saved successfully',
                session: {
                    id: timestamp,
                    name: sessionData.name,
                    playerCount: sessionData.playerCount,
                    totalDps: sessionData.totalDps
                }
            });
        } catch (error) {
            logger.error('Failed to save session:', error);
            res.status(500).json({
                code: 1,
                msg: 'Failed to save session',
                error: error.message
            });
        }
    });

    // Get ALL sessions (no limit) for session manager
    // CRITICAL: This MUST be defined BEFORE /api/sessions/:id to avoid route conflict
    app.get('/api/sessions/all', async (req, res) => {
        console.log('🚀 /api/sessions/all endpoint HIT!');
        logger.info('🚀 /api/sessions/all endpoint HIT!');
        try {
            console.log(`📂 Loading sessions from: ${SESSIONS_PATH}`);
            logger.info(`📂 Loading sessions from: ${SESSIONS_PATH}`);
            await fsPromises.mkdir(SESSIONS_PATH, { recursive: true });
            const files = await fsPromises.readdir(SESSIONS_PATH);
            console.log(`📋 Found ${files.length} files in sessions directory`);
            logger.info(`📋 Found ${files.length} files in sessions directory`);
            const sessionFiles = files.filter(f => f.endsWith('.json'));
            console.log(`📊 Found ${sessionFiles.length} session files`);
            logger.info(`📊 Found ${sessionFiles.length} session files`);

            const sessions = await Promise.all(
                sessionFiles.map(async (file) => {
                    try {
                        const filePath = path.join(SESSIONS_PATH, file);
                        const data = await fsPromises.readFile(filePath, 'utf8');
                        const session = JSON.parse(data);
                        return {
                            id: path.basename(file, '.json'),
                            ...session
                        };
                    } catch (error) {
                        logger.error(`Failed to read session ${file}:`, error);
                        return null;
                    }
                })
            );

            const validSessions = sessions.filter(s => s !== null).sort((a, b) => b.timestamp - a.timestamp);
            logger.info(`✅ Returning ${validSessions.length} valid sessions`);
            res.json({ code: 0, sessions: validSessions });
        } catch (error) {
            logger.error(`❌ Failed to fetch all sessions: ${error.message}`, error);
            res.json({ code: 1, msg: error.message, sessions: [] });
        }
    });
    
    console.log('✅ /api/sessions/all endpoint REGISTERED');
    logger.info('✅ /api/sessions/all endpoint REGISTERED');

    // Get a specific session by ID
    // CRITICAL: This MUST be defined AFTER /api/sessions/all to avoid route conflict
    app.get('/api/sessions/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const filePath = path.join(SESSIONS_PATH, `${id}.json`);

            const data = await fsPromises.readFile(filePath, 'utf8');
            const session = JSON.parse(data);

            res.json({
                code: 0,
                session: session
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    code: 1,
                    msg: 'Session not found'
                });
            } else {
                logger.error('Failed to load session:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to load session',
                    error: error.message
                });
            }
        }
    });

    // Delete a session
    app.delete('/api/sessions/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const filePath = path.join(SESSIONS_PATH, `${id}.json`);

            // Check if file exists
            await fsPromises.access(filePath);
            
            // Delete the file
            await fsPromises.unlink(filePath);
            
            logger.info(`🗑️ Deleted session: ${id}`);
            
            res.json({
                code: 0,
                msg: 'Session deleted successfully'
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({
                    code: 1,
                    msg: 'Session not found'
                });
            } else {
                logger.error('Failed to delete session:', error);
                res.status(500).json({
                    code: 1,
                    msg: 'Failed to delete session',
                    error: error.message
                });
            }
        }
    });

    // Retrofit old session names to new intelligent format
    app.post('/api/sessions/retrofit-names', async (req, res) => {
        try {
            await fsPromises.mkdir(SESSIONS_PATH, { recursive: true });
            const files = await fsPromises.readdir(SESSIONS_PATH);
            const sessionFiles = files.filter(f => f.endsWith('.json'));
            let updated = 0;

            for (const file of sessionFiles) {
                try {
                    const filePath = path.join(SESSIONS_PATH, file);
                    const data = await fsPromises.readFile(filePath, 'utf8');
                    const session = JSON.parse(data);

                    // Check if name needs updating (old formats or inconsistent formats)
                    const needsUpdate = session.name && (
                        session.name.includes('Previous Battle') || 
                        session.name.includes('Auto-saved') ||
                        session.name.includes('Solo -') ||
                        session.name.includes('P Party -') ||
                        session.name.includes('P Raid -') ||
                        session.name.includes('P Battle -') ||
                        !session.name.match(/^\d{2}\/\d{2} \d{1,2}:\d{2} (AM|PM) - .+ - .+ \(\d+p\)$/)
                    );
                    
                    if (needsUpdate) {
                        const playerCount = session.players?.length || session.playerCount || 0;
                        const duration = session.duration || 0;
                        const zoneContext = session.zoneContext || 'Battle';

                        // Format: MM/DD H:MM AM - Zone - Xm (Yp)
                        const date = new Date(session.timestamp);
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const day = date.getDate().toString().padStart(2, '0');
                        const hours = date.getHours();
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        const hours12 = hours % 12 || 12;
                        
                        const timeStr = `${hours12}:${minutes} ${ampm}`;
                        const dateStr = `${month}/${day}`;
                        
                        // Format duration
                        const mins = Math.floor(duration / 60);
                        const secs = duration % 60;
                        const durationStr = mins === 0 ? `${secs}s` : (mins < 5 ? `${mins}m${secs}s` : `${mins}min`);

                        session.name = `${dateStr} ${timeStr} - ${zoneContext} - ${durationStr} (${playerCount}p)`;
                        await fsPromises.writeFile(filePath, JSON.stringify(session, null, 2));
                        updated++;
                        logger.info(`✅ Retrofitted: ${session.name}`);
                    }
                } catch (error) {
                    logger.error(`Failed to retrofit session ${file}:`, error);
                }
            }

            logger.info(`Retrofitted ${updated} session names`);
            res.json({ code: 0, updated, msg: `Updated ${updated} sessions` });
        } catch (error) {
            logger.error(`Failed to retrofit sessions: ${error.message}`);
            res.json({ code: 1, msg: error.message, updated: 0 });
        }
    });

    // Bulk delete sessions
    app.post('/api/sessions/bulk-delete', async (req, res) => {
        try {
            const { sessionIds } = req.body;
            if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
                return res.json({ code: 1, msg: 'No session IDs provided' });
            }

            let deleted = 0;
            for (const id of sessionIds) {
                try {
                    const filePath = path.join(SESSIONS_PATH, `${id}.json`);
                    await fsPromises.unlink(filePath);
                    deleted++;
                } catch (error) {
                    logger.error(`Failed to delete session ${id}:`, error);
                }
            }

            logger.info(`Bulk deleted ${deleted} sessions`);
            res.json({ code: 0, deleted, msg: `Deleted ${deleted} sessions` });
        } catch (error) {
            logger.error(`Failed to bulk delete: ${error.message}`);
            res.json({ code: 1, msg: error.message, deleted: 0 });
        }
    });

    // Delete all auto-saved sessions
    app.post('/api/sessions/delete-auto-saved', async (req, res) => {
        try {
            await fsPromises.mkdir(SESSIONS_PATH, { recursive: true });
            const files = await fsPromises.readdir(SESSIONS_PATH);
            const sessionFiles = files.filter(f => f.endsWith('.json'));
            let deleted = 0;

            for (const file of sessionFiles) {
                try {
                    const filePath = path.join(SESSIONS_PATH, file);
                    const data = await fsPromises.readFile(filePath, 'utf8');
                    const session = JSON.parse(data);
                    if (session.autoSaved) {
                        await fsPromises.unlink(filePath);
                        deleted++;
                    }
                } catch (error) {
                    logger.error(`Failed to check/delete session ${file}:`, error);
                }
            }

            logger.info(`Deleted ${deleted} auto-saved sessions`);
            res.json({ code: 0, deleted, msg: `Deleted ${deleted} auto-saved sessions` });
        } catch (error) {
            logger.error(`Failed to delete auto-saved sessions: ${error.message}`);
            res.json({ code: 1, msg: error.message, deleted: 0 });
        }
    });

    // Rename a session
    app.post('/api/sessions/:id/rename', async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            if (!name || !name.trim()) {
                return res.json({ code: 1, msg: 'Invalid name' });
            }

            const filePath = path.join(SESSIONS_PATH, `${id}.json`);
            const data = await fsPromises.readFile(filePath, 'utf8');
            const session = JSON.parse(data);
            session.name = name.trim();
            await fsPromises.writeFile(filePath, JSON.stringify(session, null, 2));

            logger.info(`Renamed session ${id} to: ${name}`);
            res.json({ code: 0, msg: 'Session renamed successfully' });
        } catch (error) {
            logger.error(`Failed to rename session: ${error.message}`);
            res.json({ code: 1, msg: error.message });
        }
    });

    // VPN Detection Endpoints
    app.get('/api/vpn/status', async (req, res) => {
        try {
            const status = await vpnDetector.getVPNStatus();
            res.json({
                code: 0,
                data: status
            });
        } catch (error) {
            logger.error('Failed to get VPN status:', error);
            res.status(500).json({
                code: 1,
                msg: 'Failed to detect VPN',
                error: error.message
            });
        }
    });

    app.get('/api/vpn/detect', async (req, res) => {
        try {
            const detection = await vpnDetector.detectVPNs();
            const guidance = vpnDetector.getGuidanceMessage(detection);
            res.json({
                code: 0,
                data: {
                    detection,
                    guidance
                }
            });
        } catch (error) {
            logger.error('Failed to detect VPNs:', error);
            res.status(500).json({
                code: 1,
                msg: 'Failed to detect VPNs',
                error: error.message
            });
        }
    });

    logger.info('📍 VPN detection endpoint registered');

    // WebSocket handlers
    io.on('connection', (socket) => {
        logger.info(`WebSocket client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.info(`WebSocket client disconnected: ${socket.id}`);
        });
    });

        logger.info('📡 WebSocket handlers registered');

    setInterval(() => {
        if (!globalSettings.isPaused) {
            // CRITICAL: Update realtime DPS/HPS before broadcasting
            // This removes old entries from the 1-second sliding window
            userDataManager.updateAllRealtimeDps();
            
            // PERFORMANCE: Only send top 30 players + local + party to reduce bandwidth
            // Backend still tracks all 357+ for logs, but frontend only needs active players
            const userData = userDataManager.getActiveUsersData(30);
            const data = {
                code: 0,
                user: userData,
            };
            io.emit('data', data);
        }
    }, 100);
    
    console.log('⏱️ Data broadcast interval started');
    logger.info('⏱️ Data broadcast interval started');
    
    // ============================================================================
    // MAPPING ENDPOINTS - Boss/Mob Detection
    // ============================================================================
    
    if (mappingManager) {
        // Get mapping statistics
        app.get('/api/mappings/stats', (req, res) => {
            try {
                const stats = mappingManager.getStats();
                res.json({ code: 0, stats });
            } catch (err) {
                logger.error('Failed to get mapping stats:', err);
                res.status(500).json({ code: -1, msg: 'Failed to get stats' });
            }
        });
        
        // Get unknown IDs for contribution
        app.get('/api/mappings/unknown', (req, res) => {
            try {
                const unknownIds = mappingManager.getUnknownIds();
                res.json({ code: 0, unknownIds });
            } catch (err) {
                logger.error('Failed to get unknown IDs:', err);
                res.status(500).json({ code: -1, msg: 'Failed to get unknown IDs' });
            }
        });
        
        // Clear unknown IDs (after contribution)
        app.post('/api/mappings/unknown/clear', (req, res) => {
            try {
                mappingManager.clearUnknownIds();
                res.json({ code: 0, msg: 'Unknown IDs cleared' });
            } catch (err) {
                logger.error('Failed to clear unknown IDs:', err);
                res.status(500).json({ code: -1, msg: 'Failed to clear unknown IDs' });
            }
        });
        
        // Force update from GitHub
        app.post('/api/mappings/update', async (req, res) => {
            try {
                await mappingManager.updateFromGitHub();
                await mappingManager.loadMappings();
                const stats = mappingManager.getStats();
                res.json({ code: 0, msg: 'Mappings updated', stats });
            } catch (err) {
                logger.error('Failed to update mappings:', err);
                res.status(500).json({ code: -1, msg: 'Failed to update mappings' });
            }
        });
        
        logger.info('📊 Mapping endpoints registered');
    }
    
    console.log('✅ API endpoints registered successfully');
    logger.info('✅ API endpoints registered successfully');
    console.log('📍 Session endpoint /api/sessions/all should be available');
    logger.info('📍 Session endpoint /api/sessions/all should be available');
    console.log('🔧 INSIDE initializeApi - COMPLETED');
    logger.info('🔧 INSIDE initializeApi - COMPLETED');
}

module.exports = initializeApi;
