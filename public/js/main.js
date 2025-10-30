// BPSR Meter v3.1.52 - Performance-Focused Implementation
// Optimized for robustness, usability, and smooth performance

'use strict';

// ============================================================================
// ERROR BOUNDARY & PERFORMANCE MONITORING
// ============================================================================

// Global error handler - prevents blank screen crashes
window.addEventListener('error', (event) => {
    console.error('💥 Uncaught error:', event.error);
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#1a1a1a;color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:99999;font-family:Arial;';
    errorDiv.innerHTML = `
        <div style="max-width:600px;text-align:center;padding:40px;">
            <h1 style="color:#ef4444;margin-bottom:20px;font-size:32px;">⚠️ Something went wrong</h1>
            <p style="color:#9ca3af;font-size:16px;margin-bottom:10px;">
                ${event.error?.message || 'An unexpected error occurred'}
            </p>
            <pre style="background:#2d2d2d;padding:15px;border-radius:8px;overflow:auto;max-width:100%;text-align:left;margin:20px 0;font-size:12px;max-height:200px;">${event.error?.stack || 'No stack trace available'}</pre>
            <button onclick="location.reload()" style="margin-top:20px;padding:12px 32px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;">
                🔄 Reload Application
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    return false;
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 Unhandled promise rejection:', event.reason);
});

// Performance monitoring
const PerformanceMonitor = {
    enabled: true,
    fps: 0,
    frameCount: 0,
    lastTime: performance.now(),
    lastLog: performance.now(),
    renderCount: 0,
    lastRenderCount: 0,
    
    update() {
        if (!this.enabled) return;
        
        this.frameCount++;
        const now = performance.now();
        
        if (now >= this.lastTime + 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
        }
        
        if (now >= this.lastLog + 10000) {
            const memoryMB = performance.memory 
                ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2)
                : 'N/A';
            const domNodes = document.querySelectorAll('*').length;
            const renderRate = this.renderCount - this.lastRenderCount;
            
            console.log(`📊 Performance: FPS=${this.fps} | Memory=${memoryMB}MB | DOM=${domNodes} nodes | Renders/10s=${renderRate}`);
            this.lastRenderCount = this.renderCount;
            this.lastLog = now;
        }
    },
    
    recordRender() {
        this.renderCount++;
    }
};

// Start performance monitoring loop
function startPerformanceMonitoring() {
    requestAnimationFrame(function loop() {
        PerformanceMonitor.update();
        requestAnimationFrame(loop);
    });
}

startPerformanceMonitoring();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    refreshInterval: 500, // 500ms balanced for smooth real-time updates
    apiBase: '/api',
    apiData: '/api/data',
    apiSkill: '/api/skill',
    apiClear: '/api/clear',
    apiPlayerDB: '/api/player-db',
    apiPause: '/api/pause',
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const STATE = {
    players: new Map(), // uid -> player data
    currentFilter: 'all',
    localPlayerUid: null,
    startTime: null,
    lastUpdate: 0,
    refreshTimer: null,
    showingAllPlayers: false, // Track Show More state
    skillsRefreshTimer: null,
    durationTimer: null,
    viewMode: 'detailed', // 'compact' or 'detailed'
    soloMode: false, // Show only local player
    zoneChanged: false, // Track if zone changed since last combat
    alwaysOnTop: true, // Default to true since Electron window starts with alwaysOnTop: true
    inCombat: false, // Track if currently in combat
    lastPlayerCount: 0, // Track player count to detect combat start
    playerLastUpdate: new Map(), // Track last update time for idle detection
    justCleared: false, // Track if we just cleared data (to prevent empty state flash)
};

// ============================================================================
// SETTINGS WITH PERSISTENCE
// ============================================================================

const CONFIG_VERSION = 2; // Increment when breaking changes occur

const SETTINGS = {
    version: CONFIG_VERSION,
    highlightLocal: true,
    showGS: true,
    refreshInterval: 0.5, // 500ms - balanced for smooth updates without stuttering (was 0.3s)
    rememberNames: true,
    autoClearOnZoneChange: true, // Clear data when entering combat after zone change
    keepDataAfterDungeon: true, // Don't clear immediately on zone exit
    overlayOpacity: 0.95, // PHASE 3: Overlay transparency (0.0-1.0)
    compactMode: false, // Persist compact vs full mode
    compactHealerMode: false, // Show healing metrics in compact mode
    fullHealerMode: false, // Show healing metrics in full mode (NEW)
    compactScale: 100, // Compact mode scale percentage (70-150%) - ONLY for compact mode
    fullModeScale: 100, // Full mode scale percentage (70-150%) - ONLY for full mode
    windowOpacity: 100, // Window opacity percentage (0-100)
    defaultSort: 'totalDmg', // Default column for ranking (totalDmg, dps, maxDps, avgDps, hps)
    
    // AUTO-UPDATER SETTINGS
    autoUpdate: 'notify', // 'disable', 'notify' (default), 'auto'
    // - disable: No update checks
    // - notify: Check and show notification (default)
    // - auto: Automatically download and install updates
    
    // SESSION MANAGEMENT
    maxSessions: 20, // Maximum number of auto-saved sessions to keep (default: 20)
    
    // Column visibility for COMPACT mode (DPS Mode)
    columnsCompact: {
        dps: true,
        maxDps: true,
        avgDps: false,
        totalDmg: true,
        hps: true,
        dmgTaken: true,  // NOW ENABLED by default - essential metric
        gs: false
    },
    
    // Column visibility for COMPACT mode (HEALER Mode)
    columnsCompactHealer: {
        hps: true,
        maxHps: true,
        totalHeal: true,
        overheal: true
    },
    
    // Column visibility for FULL mode (DPS Mode)
    columnsFull: {
        dps: true,
        maxDps: true,
        avgDps: true,
        totalDmg: true,
        hps: true,
        dmgTaken: true,
        gs: true,
    },
    
    // Column visibility for FULL mode (HEALER Mode)
    columnsFullHealer: {
        hps: true,
        maxHps: true,
        totalHeal: true,
        overheal: true,
        efficiency: false // Not yet implemented in backend
    },
    
    async load() {
        try {
            // PRIORITY 1: Load from AppData settings.json (permanent storage)
            try {
                const res = await fetch('/api/settings/load');
                const data = await res.json();
                if (data.code === 0 && data.settings) {
                    const savedSettings = data.settings;
                    this.mergeSettings(savedSettings);
                    console.log('✅ Settings loaded from AppData (permanent storage)');
                    return; // Successfully loaded from permanent storage
                }
            } catch (err) {
                console.warn('Could not load from AppData, falling back to localStorage:', err);
            }
            
            // FALLBACK: Load from localStorage (can be cleared)
            const saved = localStorage.getItem('bpsr-settings');
            if (saved) {
                const savedSettings = JSON.parse(saved);
                this.mergeSettings(savedSettings);
                console.log('⚠️ Settings loaded from localStorage (not permanent)');
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    },
    
    mergeSettings(savedSettings) {
        if (savedSettings.version < CONFIG_VERSION) {
            // Perform migration if version is outdated
        }
        // Merge top-level settings
        Object.keys(savedSettings).forEach(key => {
            if (key === 'columnsCompact' && typeof savedSettings.columnsCompact === 'object') {
                Object.assign(this.columnsCompact, savedSettings.columnsCompact);
            } else if (key === 'columnsFull' && typeof savedSettings.columnsFull === 'object') {
                Object.assign(this.columnsFull, savedSettings.columnsFull);
            } else if (key === 'columns' && typeof savedSettings.columns === 'object') {
                // Backward compatibility
                Object.assign(this.columnsCompact, savedSettings.columns);
                Object.assign(this.columnsFull, savedSettings.columns);
            } else if (key !== 'load' && key !== 'save' && key !== 'mergeSettings') {
                this[key] = savedSettings[key];
            }
        });
    },
    
    save() {
        try {
            const { load, save, mergeSettings, ...settings } = this;
            
            // Save to localStorage (quick access)
            localStorage.setItem('bpsr-settings', JSON.stringify(settings));
            
            // CRITICAL: Save to AppData settings.json (PERMANENT - survives cache clear)
            fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            }).then(res => res.json())
              .then(data => {
                  if (data.code === 0) {
                      console.log('✅ Settings saved to AppData');
                  }
              })
              .catch(err => console.error('❌ Failed to save settings to AppData:', err));
            
            // Also sync relevant settings to globalSettings
            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    autoClearOnZoneChange: settings.autoClearOnZoneChange,
                    keepDataAfterDungeon: settings.keepDataAfterDungeon,
                    autoUpdate: settings.autoUpdate,
                    maxSessions: settings.maxSessions || 20
                })
            }).catch(err => console.error('Failed to sync globalSettings:', err));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    },
};

// ============================================================================
// PLAYER DATABASE (Persistent UID -> Name Mapping)
// ============================================================================

const PLAYER_DB = {
    data: new Map(),
    
    load() {
        try {
            const saved = localStorage.getItem('bpsr-player-db');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = new Map(Object.entries(parsed));
                // Loaded ${this.data.size} players from database
            } else {
                // No player database found
            }
        } catch (e) {
            console.error('Failed to load player database:', e);
        }
    },
    
    save() {
        if (!SETTINGS.rememberNames) {
            // Not saving player DB - disabled
            return;
        }
        try {
            const obj = Object.fromEntries(this.data);
            localStorage.setItem('bpsr-player-db', JSON.stringify(obj));
            // Saved ${this.data.size} players
        } catch (e) {
            console.error('❌ Failed to save player database:', e);
        }
    },
    
    add(uid, name) {
        if (!name || name === 'unknown' || name === '') return;
        const key = String(uid);
        const existing = this.data.get(key);
        if (existing !== name) {
            this.data.set(key, name);
            this.save();
            // Added/Updated player in DB
        }
    },
    
    get(uid) {
        return this.data.get(String(uid));
    }
};

// ============================================================================
// PROFESSION MAPPING
// ============================================================================

const PROFESSIONS = {
    '雷影剑士': { name: 'Stormblade', role: 'dps' },
    '冰魔导师': { name: 'Frost Mage', role: 'dps' },
    '涤罪恶火·战斧': { name: 'Fire Axe', role: 'dps' },
    '青岚骑士': { name: 'Wind Knight', role: 'tank' },
    '森语者': { name: 'Verdant Oracle', role: 'heal' },
    '雷霆一闪·手炮': { name: 'Gunner', role: 'dps' },
    '巨刃守护者': { name: 'Heavy Sword', role: 'dps' },
    '暗灵祈舞·仪刀/仪仗': { name: 'Spirit Dancer', role: 'dps' },
    '神射手': { name: 'Marksman', role: 'dps' },
    '神盾骑士': { name: 'Shield Knight', role: 'tank' },
    '灵魂乐手': { name: 'Soul Musician', role: 'dps' },
    '居合': { name: 'Iaido', role: 'dps' },
    '月刃': { name: 'MoonStrike', role: 'dps' },
    '冰矛': { name: 'Icicle', role: 'dps' },
    '射线': { name: 'Frostbeam', role: 'dps' },
    '防盾': { name: 'Vanguard', role: 'tank' },
    '岩盾': { name: 'Skyward', role: 'tank' },
    '惩戒': { name: 'Smite', role: 'dps' },
    '愈合': { name: 'Lifebind', role: 'heal' },
    '格挡': { name: 'Block', role: 'tank' },
    '狼弓': { name: 'Wildpack', role: 'dps' },
    '鹰弓': { name: 'Falconry', role: 'dps' },
    '光盾': { name: 'Shield', role: 'tank' },
    '协奏': { name: 'Concerto', role: 'heal' },
    '狂音': { name: 'Dissonance', role: 'heal' },
    '空枪': { name: 'Empty Gun', role: 'dps' },
    '重装': { name: 'Vanguard Spec', role: 'dps' },
    '未知': { name: 'Unknown', role: 'unknown' },  // Undetected profession
    '': { name: 'Unknown', role: 'unknown' },       // Empty profession
};

// Detect role from sub-profession or healing/tanking behavior
function detectRoleFromBehavior(player) {
    const totalDmg = player.total_damage?.total || 0;
    const totalHeal = player.total_healing?.total || 0;
    const dmgTaken = player.taken_damage || 0;
    const totalHps = player.total_hps || 0;
    const totalDps = player.total_dps || 0;
    
    // Healer detection: healing is PRIMARY role (much more healing than damage)
    // Healers typically have healing >> damage (3x+) AND high HPS
    if (totalHeal > totalDmg * 3 && totalHps > 100) {
        return 'heal';
    }
    
    // OR extremely high HPS compared to DPS (dedicated healer)
    if (totalHps > totalDps * 5 && totalHps > 500) {
        return 'heal';
    }
    
    // Tank detection: takes significant damage relative to damage dealt
    // Tanks may have self-heal but damage taken is the key indicator
    if (dmgTaken > totalDmg * 0.2 && totalDmg > 5000) {
        return 'tank';
    }
    
    // High damage taken with low damage output = pure tank
    if (dmgTaken > 50000 && totalDmg < 10000) {
        return 'tank';
    }
    
    // Default to DPS (includes tanks with self-heal that don't take much damage yet)
    return 'dps';
}

function getProfession(profStr, player = null) {
    const base = profStr?.split('-')[0];
    const sub = profStr?.split('-')[1];
    
    // Check sub-profession first (more specific)
    if (sub && PROFESSIONS[sub]) {
        return PROFESSIONS[sub];
    }
    
    // Then check base profession
    const result = PROFESSIONS[base];
    if (result && result.role !== 'unknown') {
        return result;
    }
    
    // If unknown profession, default to DPS (don't use behavior detection)
    // Behavior detection was incorrectly classifying high-damage DPS as tanks
    // Better to default to DPS than misclassify
    return { name: base || 'Unknown', role: 'dps' };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(val) {
    if (!Number.isFinite(val)) return '0';
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'k';
    return Math.round(val).toString();
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getHPColor(percent) {
    if (percent >= 75) return '#22c55e';
    if (percent >= 50) return '#facc15';
    if (percent >= 25) return '#f97316';
    return '#ef4444';
}

// DATA FETCHING & MERGING
// ============================================================================

async function fetchPlayerData() {
    // Don't fetch new data when paused - maintain frozen state
    if (isPaused) {
        return Array.from(STATE.players.values());
    }
    
    try {
        const res = await fetch(CONFIG.apiData);
        if (!res.ok) {
            console.error(`❌ API request failed: ${res.status} ${res.statusText}`);
            throw new Error('Failed to fetch data');
        }
        
        const payload = await res.json();
        
        // API returns { code: 0, players: [...], serverChanged: bool }
        const playerData = payload.players || [];
        const serverChanged = payload.serverChanged || false;
        
        // DEBUG: Log server change detection
        if (serverChanged) {
            console.log(`🚨 SERVER CHANGE FLAG RECEIVED: serverChanged=${serverChanged}, autoClearOnZoneChange=${SETTINGS.autoClearOnZoneChange}, players in STATE=${STATE.players.size}, new players=${playerData.length}`);
        }
        
        // Detect combat start (new data appearing)
        const hasActivePlayers = playerData.length > 0 && 
            playerData.some(p => (p.total_damage?.total || 0) > 0 || (p.total_healing?.total || 0) > 0);
        
        // CRITICAL FIX: FORCE CLEAR on zone/server change
        // Backend tells us when server changed via serverChanged flag
        // MUST also check SETTINGS.autoClearOnZoneChange to respect user preference
        if (serverChanged && SETTINGS.autoClearOnZoneChange) {
            console.log('🌍 ZONE/SERVER CHANGE DETECTED BY FRONTEND - Forcing display clear');
            
            // Save previous session if there was combat data
            if (STATE.players.size > 0 && STATE.startTime) {
                const duration = Math.floor((Date.now() - STATE.startTime) / 1000);
                if (duration > 10) { // Only save if fight lasted more than 10 seconds
                    console.log('💾 Auto-saving previous battle before zone clear...');
                    // Fire and forget to avoid blocking
                    autoSaveSession('Previous Battle (Auto-saved)').catch(err => {
                        console.error('Failed to auto-save session:', err);
                    });
                }
            }
            
            // FORCE CLEAR - Wipe everything
            console.log('✨ FORCE CLEARING all data for zone change');
            STATE.players.clear();
            STATE.playerLastUpdate.clear();
            STATE.startTime = null;
            STATE.inCombat = false;
            STATE.lastUpdate = Date.now();
            STATE.justCleared = true; // Prevent empty state flash
            
            // Clear the flag after 2 seconds to allow new data to populate
            setTimeout(() => {
                STATE.justCleared = false;
            }, 2000);
            
            // Force UI update
            renderPlayers();
            updateStatusBar();
            stopDurationCounter();
        } else if (serverChanged && !SETTINGS.autoClearOnZoneChange) {
            console.log('ℹ️ Zone changed but auto-clear disabled - keeping current data');
        }
        
        // OLD LOGIC (deprecated by serverChanged flag)
        // Keeping for backwards compatibility in case serverChanged is false
        if (!serverChanged && payload.zoneChanged && SETTINGS.autoClearOnZoneChange && STATE.players.size > 0 && STATE.startTime) {
            const shouldClearNow = !SETTINGS.keepDataAfterDungeon || hasActivePlayers;
            
            if (shouldClearNow) {
                const duration = Math.floor((Date.now() - STATE.startTime) / 1000);
                if (duration > 10) { // Only save if fight lasted more than 10 seconds
                    const mode = SETTINGS.keepDataAfterDungeon ? 'keep mode' : 'immediate clear mode';
                    console.log(`🔄 Zone changed (${mode}) - Auto-saving previous battle...`);
                    // CRITICAL: Don't await - fire and forget to avoid blocking refresh
                    autoSaveSession('Previous Battle (Auto-saved)').catch(err => {
                        console.error('Failed to auto-save session:', err);
                    });
                }
                
                // Reset DPS stats but PRESERVE player names to prevent "Unknown" players
                console.log('✨ Resetting stats for new zone (preserving player names)');
                STATE.players.forEach(player => {
                    // Keep: name, uid, class_id
                    // Reset: all damage/healing stats
                    player.total_damage = { total: 0 };
                    player.total_healing = { total: 0 };
                    player.taken_damage = 0; // FIX: Should be taken_damage, not total_damage_taken
                    player.current_dps = 0;
                    player.max_dps = 0;
                    player.realtime_dps = 0;
                    player.realtime_dps_max = 0;
                });
                STATE.startTime = null;
            }
        }
        
        // Update combat state and manage timer
        const wasInCombat = STATE.inCombat;
        STATE.inCombat = hasActivePlayers;
        
        // Start timer when combat begins (use frontend timestamp, not backend)
        if (!STATE.startTime && hasActivePlayers) {
            STATE.startTime = Date.now();
            startDurationCounter();
        }
        
        // Stop timer when combat ends (no active players)
        if (wasInCombat && !hasActivePlayers && STATE.startTime) {
            stopDurationCounter();
        }
        
        // REMOVED: Aggressive character switch detection that was clearing data
        // User complaint: "everyone is showing up as Unknown, sessions are missing"
        // This was TOO AGGRESSIVE and cleared data when it shouldn't
        // Only update local player UID, DON'T clear data
        const newLocalPlayerUid = playerData.find(p => p.isLocalPlayer)?.uid;
        
        // Update local player UID if we have a local player
        if (newLocalPlayerUid) {
            STATE.localPlayerUid = newLocalPlayerUid;
        }
        
        // Merge player data (preserve accumulated stats)
        if (playerData && Array.isArray(playerData)) {
            playerData.forEach(player => {
                const uid = player.uid;
                const existing = STATE.players.get(uid);
                
                if (existing) {
                    const preservedName = existing.name;
                    const lastDps = existing.current_dps || existing.realtime_dps || 0;
                    const lastMaxDps = existing.max_dps || existing.realtime_dps_max || 0;
                    
                    Object.assign(existing, player);
                    
                    if (!existing.name && preservedName) {
                        existing.name = preservedName;
                    }
                    
                    const newDps = player.current_dps || player.realtime_dps || 0;
                    if (newDps === 0 && lastDps > 0) {
                        existing.current_dps = lastDps;
                        existing.realtime_dps = lastDps;
                    }
                    if ((player.max_dps || 0) === 0 && lastMaxDps > 0) {
                        existing.max_dps = lastMaxDps;
                        existing.realtime_dps_max = lastMaxDps;
                    }
                } else {
                    STATE.players.set(uid, player);
                }
                
                const hasActivity = (player.total_damage?.total || 0) > 0 || (player.total_healing?.total || 0) > 0;
                if (hasActivity) {
                    STATE.playerLastUpdate.set(uid, Date.now());
                }
                
                const nameToSave = player.name || existing?.name;
                if (nameToSave && nameToSave !== 'unknown' && nameToSave !== '') {
                    PLAYER_DB.add(uid, nameToSave);
                }
            });
            
            STATE.lastUpdate = Date.now();
        }
        
        STATE.lastPlayerCount = playerData.length;
        
        return Array.from(STATE.players.values());
    } catch (error) {
        console.error('Error fetching data:', error);
        return Array.from(STATE.players.values());
    }
}

// ============================================================================
// RENDERING
// ============================================================================

// PERFORMANCE: Cache for role badges to avoid recalculation
const ROLE_BADGE_CACHE = {
    heal: { color: '#22c55e', text: 'H' },
    tank: { color: '#3b82f6', text: 'T' },
    dps: { color: '#ef4444', text: 'D' }
};

function renderPlayerRow(player, rank, maxDmg, isLocal, teamTotalDamage = 1) {
    const prof = getProfession(player.profession, player);
    
    // CRITICAL FIX: Detect and save local player UID when we see Unknown_UID pattern
    const savedName = PLAYER_DB.get(player.uid);
    let name = player.name || savedName || `Unknown_${player.uid}`;
    
    // If this is the local player (detected by Unknown_ pattern and no saved name), remember the UID
    if (!savedName && name.startsWith('Unknown_') && (player.isLocalPlayer || player.uid === STATE.localPlayerUid)) {
        // This is local player - save UID for future sessions
        if (!STATE.localPlayerUid) {
            STATE.localPlayerUid = player.uid;
            console.log(`🎯 Detected local player UID: ${player.uid}`);
        }
    }
    
    const hp = player.hp || 0;
    const maxHp = player.max_hp || 1;
    const hpPercent = (hp / maxHp) * 100;
    const dmgBarPercent = ((player.total_damage?.total || 0) / maxDmg) * 100;
    
    const gs = player.fightPoint || 0;
    const currentDps = player.current_dps || player.realtime_dps || 0;
    const maxDps = player.max_dps || player.realtime_dps_max || 0;
    const avgDps = player.total_dps || 0;
    const hps = player.total_hps || 0;
    const maxHps = player.realtime_hps_max || 0;
    const totalDmg = player.total_damage?.total || 0;
    const dmgTaken = player.taken_damage || 0;
    const totalHealing = player.total_healing?.total || 0;
    const crit = (player.critRate || 0).toFixed(0);
    const luck = (player.luckyRate || 0).toFixed(0);
    const maxDmgVal = player.maxDamage || 0;
    const haste = player.haste || 0;
    
    const contributionPercent = teamTotalDamage > 0 ? ((totalDmg / teamTotalDamage) * 100).toFixed(1) : 0;
    
    const rankClass = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
    const isExpanded = expandedPlayerIds.includes(player.uid);
    const isCompact = STATE.viewMode === 'compact';
    const isIdle = player.isIdle || false;
    
    if (document.body.classList.contains('compact-mode')) {
        // Compact mode: Simple 6-column grid (rank + name + 4 stats)
        // Grid: 25px | minmax(80px,120px) | 65px | 65px | 65px | 65px
        
        // PERFORMANCE: Use cached role badge values
        const badge = ROLE_BADGE_CACHE[prof.role] || ROLE_BADGE_CACHE.dps;
        const roleBadge = `<span class="role-badge-compact" style="background: ${badge.color}">${badge.text}</span>`;
        
        if (SETTINGS.compactHealerMode) {
            // HEALER MODE: Show HPS, MAX HPS, TOTAL HEAL, OVERHEAL
            // Use real backend values if available, otherwise estimate
            const effectiveHealing = player.total_healing?.effective ?? (totalHealing * 0.75);
            const overheal = player.total_healing?.overheal ?? (totalHealing - effectiveHealing);
            const overhealDisplay = overheal > 0 ? formatNumber(overheal) : '-';
            
            return `
                <div class="player-row ${isLocal ? 'local-player' : ''} ${isIdle ? 'idle' : ''}" data-uid="${player.uid}">
                    <div class="cell-rank">${rank}</div>
                    <div class="cell-name">
                        ${roleBadge}
                        <span class="${prof.class}">${name}</span>
                    </div>
                    <div class="cell-value">${formatNumber(hps)}</div>
                    <div class="cell-value">${formatNumber(maxHps)}</div>
                    <div class="cell-value">${formatNumber(totalHealing)}</div>
                    <div class="cell-value">${overhealDisplay}</div>
                </div>
            `;
        } else {
            // DPS MODE: Show DPS, MAX DPS, TOTAL DMG, DMG TAKEN
            // Always show values, use 0 instead of dash
            const dmgTakenDisplay = formatNumber(dmgTaken);
            
            return `
                <div class="player-row ${isLocal ? 'local-player' : ''} ${isIdle ? 'idle' : ''}" data-uid="${player.uid}">
                    <div class="cell-rank">${rank}</div>
                    <div class="cell-name">
                        ${roleBadge}
                        <span class="${prof.class}">${name}</span>
                    </div>
                    <div class="cell-value">${formatNumber(currentDps)}</div>
                    <div class="cell-value">${formatNumber(maxDps)}</div>
                    <div class="cell-value">${formatNumber(totalDmg)}</div>
                    <div class="cell-value">${dmgTakenDisplay}</div>
                </div>
            `;
        }
    }
    
    // CRITICAL FIX: Full mode needs to respect fullHealerMode setting
    if (SETTINGS.fullHealerMode) {
        // HEALER MODE: Show HPS, MAX HPS, TOTAL HEAL, OVERHEAL instead of DPS columns
        const effectiveHealing = player.total_healing?.effective ?? (totalHealing * 0.75);
        const overheal = player.total_healing?.overheal ?? (totalHealing - effectiveHealing);
        
        return `
            <div class="player-row-wrapper">
                <div class="player-row ${isLocal ? 'local' : ''} ${isExpanded ? 'expanded' : ''} ${isIdle ? 'idle' : ''}" 
                     style="--dmg-percent: ${dmgBarPercent}%"
                     data-uid="${player.uid}"
                     title="${isIdle ? 'IDLE - No activity for 30+ seconds' : ''}">
                    <div class="rank ${rankClass}">${rank}</div>
                    <div class="player-name-col">
                        <div class="name-line">
                            ${isLocal && (player.isLocalPlayer || player.uid === STATE.localPlayerUid) ? '<span class="local-star">★</span>' : ''}
                            <span class="name">${name}${isIdle ? ' <span style="opacity:0.5">(IDLE)</span>' : ''}</span>
                            <span class="role-badge ${prof.role}">${prof.role.toUpperCase()}</span>
                        </div>
                        <div class="hp-bar-mini">
                            <div class="hp-fill" style="width: ${hpPercent}%; background: ${getHPColor(hpPercent)}"></div>
                        </div>
                    </div>
                    <div class="cell-value">${formatNumber(hps)}</div>
                    <div class="cell-value">${formatNumber(maxHps)}</div>
                    <div class="cell-value">${formatNumber(totalHealing)}</div>
                    <div class="cell-value">${formatNumber(overheal)}</div>
                    <div class="cell-value">${formatNumber(hps)}${maxHps > 0 ? ` / ${formatNumber(maxHps)}` : ''}</div>
                    <div class="cell-value">${formatNumber(dmgTaken)}</div>
                    <div class="cell-value">${gs > 0 ? formatNumber(gs) : '-'}</div>
                </div>
                ${isExpanded ? renderPlayerDetails(player) : ''}
            </div>
        `;
    }
    
    // DPS MODE (default): Show DPS columns
    return `
        <div class="player-row-wrapper">
            <div class="player-row ${isLocal ? 'local' : ''} ${isExpanded ? 'expanded' : ''} ${isIdle ? 'idle' : ''}" 
                 style="--dmg-percent: ${dmgBarPercent}%"
                 data-uid="${player.uid}"
                 title="${isIdle ? 'IDLE - No activity for 30+ seconds' : ''}">
                <div class="rank ${rankClass}">${rank}</div>
                <div class="player-name-col">
                    <div class="name-line">
                        ${isLocal && (player.isLocalPlayer || player.uid === STATE.localPlayerUid) ? '<span class="local-star">★</span>' : ''}
                        <span class="name">${name}${isIdle ? ' <span style="opacity:0.5">(IDLE)</span>' : ''}</span>
                        <span class="role-badge ${prof.role}">${prof.role.toUpperCase()}</span>
                    </div>
                    <div class="hp-bar-mini">
                        <div class="hp-fill" style="width: ${hpPercent}%; background: ${getHPColor(hpPercent)}"></div>
                    </div>
                </div>
                <div class="cell-value">${formatNumber(currentDps)}</div>
                <div class="cell-value">${formatNumber(maxDps)}</div>
                <div class="cell-value">${formatNumber(avgDps)}</div>
                <div class="cell-value">${formatNumber(totalDmg)} <span class="contribution-percent">(${contributionPercent}%)</span></div>
                <div class="cell-value">${formatNumber(hps)}${maxHps > 0 ? ` / ${formatNumber(maxHps)}` : ''}</div>
                <div class="cell-value">${formatNumber(dmgTaken)}</div>
                <div class="cell-value">${gs > 0 ? formatNumber(gs) : '-'}</div>
            </div>
            ${isExpanded ? renderPlayerDetails(player) : ''}
        </div>
    `;
}

function renderPlayerDetails(player) {
    const prof = getProfession(player.profession, player);
    const gs = player.g_score || player.gs || 0;
    
    return `
        <div class="player-details">
            <div class="details-row">
                <div class="detail-stat">
                    <span class="detail-label">Class:</span>
                    <span class="detail-value">${prof.name} (${prof.role.toUpperCase()})</span>
                </div>
                <div class="detail-stat">
                    <span class="detail-label">Gear Score:</span>
                    <span class="detail-value">${gs > 0 ? formatNumber(gs) : 'N/A'}</span>
                </div>
            </div>
            <div class="details-row">
                <div class="detail-stat">
                    <span class="detail-label">Crit Rate:</span>
                    <span class="detail-value">${(player.critRate || 0).toFixed(1)}%</span>
                </div>
                <div class="detail-stat">
                    <span class="detail-label">Lucky Rate:</span>
                    <span class="detail-value">${(player.luckyRate || 0).toFixed(1)}%</span>
                </div>
                <div class="detail-stat">
                    <span class="detail-label">Max Damage:</span>
                    <span class="detail-value">${formatNumber(player.maxDamage || 0)}</span>
                </div>
                <div class="detail-stat">
                    <span class="detail-label">Haste:</span>
                    <span class="detail-value">${player.haste > 0 ? player.haste : 'N/A'}</span>
                </div>
                <div class="detail-stat">
                    <span class="detail-label">Mastery:</span>
                    <span class="detail-value">${player.mastery > 0 ? player.mastery : 'N/A'}</span>
                </div>
            </div>
            <div class="skills-title">Skills</div>
            <div id="skills-${player.uid}" class="skills-container">Loading...</div>
        </div>
    `;
}

function updateStatusBar(activeNonIdlePlayers = []) {
    const players = Array.from(STATE.players.values());
    const activePlayers = players.filter(p => {
        const hasDamage = (p.total_damage?.total || 0) > 0;
        const hasHealing = (p.total_healing?.total || 0) > 0;
        return hasDamage || hasHealing;
    });
    
    const playerCountEl = document.getElementById('status-players');
    if (playerCountEl) {
        playerCountEl.textContent = `${activePlayers.length} Player${activePlayers.length !== 1 ? 's' : ''}`;
    }
    
    const networkEl = document.getElementById('status-network');
    if (networkEl) {
        const timeSinceUpdate = Date.now() - STATE.lastUpdate;
        if (timeSinceUpdate > 10000) {
            networkEl.textContent = 'No Data';
            networkEl.style.color = 'var(--accent-dps)';
        } else {
            networkEl.textContent = 'Capturing Packets';
            networkEl.style.color = 'var(--text-secondary)';
        }
    }
    
    const dpsEl = document.getElementById('status-dps');
    if (dpsEl) {
        const localPlayer = activeNonIdlePlayers.find(p => p.isLocalPlayer || p.uid === STATE.localPlayerUid);
        const myDPS = localPlayer ? (localPlayer.current_dps || localPlayer.realtime_dps || 0) : 0;
        dpsEl.textContent = `${formatNumber(myDPS)} DPS`;
    }
    
    // Update "Current Session" dropdown text with live stats
    updateCurrentSessionText();
}

const dirtyPlayers = new Set();
let lastPlayerState = new Map();

function markPlayerDirty(uid) {
    dirtyPlayers.add(uid);
}

function renderPlayers() {
    PerformanceMonitor.recordRender();
    
    const players = Array.from(STATE.players.values());
    
    // CRITICAL FIX: Save currently expanded players with cached skills
    const expandedWithSkills = expandedPlayerIds
        .filter(uid => skillsCache.has(uid))
        .map(uid => ({ uid, skills: skillsCache.get(uid) }));
    
    if (players.length === 0) {
        // Hide column headers when no data (prevents visual mismatch)
        const headers = document.querySelector('.column-headers');
        if (headers) {
            headers.style.display = 'none';
        }
        
        const list = document.getElementById('player-list');
        if (list) {
            // Don't show empty state if we just cleared (prevents flash during zone reset)
            if (!STATE.justCleared) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-users-slash"></i>
                        <p>No combat data yet</p>
                        <small>Change instance/zone to start tracking</small>
                    </div>
                `;
            } else {
                // Show a subtle "transitioning" message instead
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <p>Waiting for new zone data...</p>
                        <small>Packets incoming</small>
                    </div>
                `;
            }
        }
        updateStatusBar([]);
        return;
    }
    
    // Show column headers when we have data
    const headers = document.querySelector('.column-headers');
    if (headers) {
        headers.style.display = '';
    }
    
    players.forEach(p => {
        // Save ANY valid name we capture (not empty, not 'unknown', not 'Unknown_xxx')
        if (p.name && 
            p.name !== 'unknown' && 
            p.name !== '' && 
            !p.name.startsWith('Unknown_')) {
            PLAYER_DB.add(p.uid, p.name);
            console.log(`💾 Saved player name: ${p.name} (UID: ${p.uid})`);
        }
        
        // If player has no name but PLAYER_DB has one, use it
        const savedName = PLAYER_DB.get(p.uid);
        if ((!p.name || p.name === 'unknown' || p.name.startsWith('Unknown_')) && savedName) {
            p.name = savedName;
            console.log(`📖 Restored player name from DB: ${p.name} (UID: ${p.uid})`);
        }
    });
    
    // Don't filter too aggressively - show all players detected by backend
    const activePlayers = players;
    
    let filtered = filterPlayers(activePlayers);
    
    if (STATE.soloMode) {
        filtered = filtered.filter(p => p.isLocalPlayer || p.uid === STATE.localPlayerUid);
    }
    
    const now = Date.now();
    const IDLE_THRESHOLD = 15000; // 15 seconds - mark as idle (greyed out)
    const REMOVE_THRESHOLD = 60000; // 60 seconds - remove from list completely
    
    // Mark idle players and remove very old idle players (except local)
    filtered.forEach(p => {
        const lastUpdate = STATE.playerLastUpdate.get(p.uid) || now;
        const idleTime = now - lastUpdate;
        p.isIdle = idleTime > IDLE_THRESHOLD;
    });
    
    // Remove players idle for 60+ seconds (keep local player always)
    filtered = filtered.filter(p => {
        const isLocal = p.isLocalPlayer || p.uid === STATE.localPlayerUid;
        if (isLocal) return true; // Always keep local player
        
        const lastUpdate = STATE.playerLastUpdate.get(p.uid) || now;
        const idleTime = now - lastUpdate;
        return idleTime < REMOVE_THRESHOLD; // Remove if idle too long
    });
    
    // CRITICAL FIX: Calculate REAL ranks based on current sort metric BEFORE priority sorting
    // Get the value function from current sort settings
    const getValueForRanking = (p) => {
        switch (currentSort.column) {
            case 'name': return (p.name || PLAYER_DB.get(p.uid) || `Unknown_${p.uid}`).toLowerCase();
            case 'dps': return p.total_dps || p.current_dps || 0;
            case 'maxDps': return p.max_dps || 0;
            case 'avgDps': return p.total_dps || 0;
            case 'totalDmg': return p.total_damage?.total || 0;
            case 'hps': return p.total_hps || 0;
            case 'dmgTaken': return p.taken_damage || 0;
            case 'gs': return p.fightPoint || 0;
            default: return p.total_damage?.total || 0;
        }
    };
    
    // Sort by metric ONLY (no local player priority) to get true ranks
    const sortedByMetricOnly = [...filtered].sort((a, b) => {
        const aVal = getValueForRanking(a);
        const bVal = getValueForRanking(b);
        
        if (currentSort.column === 'name') {
            return currentSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    // Store actual rank on each player
    sortedByMetricOnly.forEach((p, index) => {
        p.actualRank = index + 1; // 1-based rank
    });
    
    // NOW apply full sorting with local player priority for display order
    const sorted = sortPlayers(filtered);
    
    const activeNonIdlePlayers = sorted.filter(p => !p.isIdle);
    
    updateStatusBar(activeNonIdlePlayers);
    const teamTotalDamage = activeNonIdlePlayers.reduce((sum, p) => sum + (p.total_damage?.total || 0), 0);
    const teamTotalHealing = activeNonIdlePlayers.reduce((sum, p) => sum + (p.total_healing?.total || 0), 0);
    const teamTotalDPS = activeNonIdlePlayers.reduce((sum, p) => sum + (p.total_dps || 0), 0);
    const teamTotalHPS = activeNonIdlePlayers.reduce((sum, p) => sum + (p.total_hps || 0), 0);
    
    const list = document.getElementById('player-list');
    if (!list) {
        console.error('❌ player-list element not found!');
        return;
    }
    
    // Show top 10 by default, rest behind "Show More"
    const isCompact = document.body.classList.contains('compact-mode');
    
    // Compact mode: Local always first, then top 5 others (max 6 total)
    let playersToShow;
    if (isCompact) {
        const localPlayer = sorted.find(p => p.isLocalPlayer || p.uid === STATE.localPlayerUid);
        const otherPlayers = sorted.filter(p => !(p.isLocalPlayer || p.uid === STATE.localPlayerUid));
        
        if (localPlayer) {
            // Local exists: Show local + top 5 others = max 6
            playersToShow = [localPlayer, ...otherPlayers.slice(0, 5)];
        } else {
            // No local: Show top 5
            playersToShow = sorted.slice(0, 5);
        }
    } else {
        // Full mode: Local player always at top (if not already in top positions), then top players
        const defaultShowCount = 10;
        const showingAll = STATE.showingAllPlayers || false;
        const baseList = showingAll ? sorted : sorted.slice(0, defaultShowCount);
        
        const localPlayer = sorted.find(p => p.isLocalPlayer || p.uid === STATE.localPlayerUid);
        const localInTopPositions = localPlayer && baseList.includes(localPlayer);
        
        if (localPlayer && !localInTopPositions) {
            // Local exists but not in top list - add them at position after rank display
            const othersWithoutLocal = baseList.filter(p => p.uid !== localPlayer.uid);
            playersToShow = [localPlayer, ...othersWithoutLocal];
        } else {
            playersToShow = baseList;
        }
    }
    
    if (sorted.length === 0) {
        const connectionStatus = STATE.lastUpdate > 0 
            ? `Connected • Last update: ${Math.floor((Date.now() - STATE.lastUpdate) / 1000)}s ago`
            : 'Connecting to server...';
        
        list.innerHTML = `
            <div class="loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Waiting for combat data...</span>
                <div style="margin-top:10px;font-size:12px;color:#9ca3af;">${connectionStatus}</div>
                <div style="margin-top:5px;font-size:11px;color:#6b7280;">Server port: ${window.location.port || '8989'}</div>
            </div>
        `;
        // Single RAF to avoid blocking drag
        setTimeout(() => autoResizeWindow(), 50);
        return;
    }
    
    const maxDmg = Math.max(...sorted.map(p => p.total_damage?.total || 0), 1);
    
    let localPlayer = null;
    let localPlayerRank = 0;
    sorted.forEach((p, idx) => {
        if (p.isLocalPlayer || p.uid === STATE.localPlayerUid) {
            localPlayer = p;
            localPlayerRank = idx + 1;
        }
    });
    
    const otherPlayers = sorted.filter(p => !(p.isLocalPlayer || p.uid === STATE.localPlayerUid));
    
    // Render Team Totals ABOVE column headers (separate from player list)
    const teamTotalsContainer = document.getElementById('team-totals-container');
    if (teamTotalsContainer) {
        if (sorted.length >= 2) {
            teamTotalsContainer.innerHTML = `
                <div class="team-totals-row">
                    <div class="team-totals-label">
                        <i class="fa-solid fa-users"></i> Team Totals (${activeNonIdlePlayers.length} active)
                    </div>
                    <div class="team-totals-stats">
                        <span title="Total Team DPS"><i class="fa-solid fa-bolt"></i> ${formatNumber(teamTotalDPS)} DPS</span>
                        <span title="Total Team Damage"><i class="fa-solid fa-fire"></i> ${formatNumber(teamTotalDamage)}</span>
                        <span title="Total Team Healing"><i class="fa-solid fa-heart"></i> ${formatNumber(teamTotalHealing)}</span>
                    </div>
                </div>
            `;
            teamTotalsContainer.style.display = 'block';
        } else {
            teamTotalsContainer.innerHTML = '';
            teamTotalsContainer.style.display = 'none';
        }
    }
    
    // Update column headers based on mode (compact or full) and healer toggle
    // isCompact already defined earlier in this function
    const healerMode = isCompact ? SETTINGS.compactHealerMode : SETTINGS.fullHealerMode;
    
    // Update full mode column headers dynamically
    const columnHeaders = document.querySelector('.column-headers');
    if (columnHeaders && !isCompact) {
        if (SETTINGS.fullHealerMode) {
            columnHeaders.innerHTML = `
                <div class="col-rank" data-sort="rank">#</div>
                <div class="col-name" data-sort="name">NAME</div>
                <div class="col-dps" data-sort="hps">HPS <i class="fa-solid fa-sort"></i></div>
                <div class="col-max-dps" data-sort="maxHps">MAX HPS <i class="fa-solid fa-sort"></i></div>
                <div class="col-avg-dps" data-sort="totalHealing">TOTAL HEAL <i class="fa-solid fa-sort"></i></div>
                <div class="col-total-dmg" data-sort="overheal">OVERHEAL <i class="fa-solid fa-sort"></i></div>
                <div class="col-hps" data-sort="hps">HPS / MAX <i class="fa-solid fa-sort"></i></div>
                <div class="col-dmg-taken" data-sort="dmgTaken">DMG TAKEN <i class="fa-solid fa-sort"></i></div>
                <div class="col-gs" data-sort="gs">GS <i class="fa-solid fa-sort"></i></div>
            `;
        } else {
            columnHeaders.innerHTML = `
                <div class="col-rank" data-sort="rank">#</div>
                <div class="col-name" data-sort="name">NAME</div>
                <div class="col-dps" data-sort="dps">DPS <i class="fa-solid fa-sort"></i></div>
                <div class="col-max-dps" data-sort="maxDps">MAX DPS <i class="fa-solid fa-sort"></i></div>
                <div class="col-avg-dps" data-sort="avgDps">AVG DPS <i class="fa-solid fa-sort"></i></div>
                <div class="col-total-dmg" data-sort="totalDmg">TOTAL DMG <i class="fa-solid fa-sort"></i></div>
                <div class="col-hps" data-sort="hps">HPS / MAX <i class="fa-solid fa-sort"></i></div>
                <div class="col-dmg-taken" data-sort="dmgTaken">DMG TAKEN <i class="fa-solid fa-sort"></i></div>
                <div class="col-gs" data-sort="gs">GS <i class="fa-solid fa-sort"></i></div>
            `;
        }
        // Re-attach sort handlers after updating innerHTML
        attachColumnSortHandlers();
    }
    
    // Add compact mode headers
    let compactHeadersHTML = '';
    if (isCompact) {
        if (SETTINGS.compactHealerMode) {
            // Healer mode: Show healing metrics
            compactHeadersHTML = `
                <div class="compact-headers">
                    <div>#</div>
                    <div>PLAYER</div>
                    <div>HPS</div>
                    <div>MAX HPS</div>
                    <div>TOTAL HEAL</div>
                    <div>OVERHEAL</div>
                </div>
            `;
        } else {
            // DPS mode: Show damage metrics
            compactHeadersHTML = `
                <div class="compact-headers">
                    <div>#</div>
                    <div>PLAYER</div>
                    <div>DPS</div>
                    <div>MAX DPS</div>
                    <div>TOTAL DMG</div>
                    <div>DMG TAKEN</div>
                </div>
            `;
        }
    }
    
    // Generate player rows HTML
    let playerRowsHTML = '';
    sorted.forEach((player, index) => {
        playerRowsHTML += renderPlayerRow(player, index + 1, teamTotalDamage, teamTotalHealing);
    });
    
    // Show More button - hidden in compact mode, visible in full mode when there are hidden players WITH DATA
    // Update header Show More button visibility
    const showMoreHeaderBtn = document.getElementById('btn-show-more');
    const showMoreText = document.getElementById('show-more-text');
    const hasData = sorted.some(p => (p.total_damage?.total || 0) > 0 || (p.total_healing?.total || 0) > 0);
    if (!isCompact && sorted.length > 10 && hasData) {
        if (showMoreHeaderBtn) showMoreHeaderBtn.style.display = 'flex';
        if (showMoreText) {
            showMoreText.textContent = STATE.showingAllPlayers ? 'Show Less' : `Show ${sorted.length - 10} More`;
        }
        const icon = showMoreHeaderBtn?.querySelector('i');
        if (icon) {
            icon.className = STATE.showingAllPlayers ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        }
    } else {
        if (showMoreHeaderBtn) showMoreHeaderBtn.style.display = 'none';
    }
    
    let showMoreButton = ''; // No longer needed at bottom
    
    // Set the HTML - ONLY show playersToShow
    // Use pre-calculated actualRank that was stored before priority sorting
    const displayHTML = playersToShow.map((player, index) => {
        const actualRank = player.actualRank || (index + 1); // Use stored rank or fallback to position
        const isLocal = player.isLocalPlayer || player.uid === STATE.localPlayerUid;
        return renderPlayerRow(player, actualRank, maxDmg, isLocal, teamTotalDamage);
    }).join('');
    list.innerHTML = compactHeadersHTML + displayHTML + showMoreButton;
    
    // Attach click handlers to player rows
    document.querySelectorAll('.player-row').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button')) {
                return;
            }
            const uid = parseInt(row.dataset.uid);
            togglePlayerDetails(uid, e);
        });
    });
    
    // CRITICAL FIX: Immediately restore cached skills for expanded players
    // This prevents "Loading..." from showing during combat re-renders
    expandedWithSkills.forEach(({ uid, skills }) => {
        const skillsContainer = document.getElementById(`skills-${uid}`);
        if (skillsContainer && skillsContainer.textContent === 'Loading...') {
            // Skills were reset by render, restore them immediately
            renderSkillsTable(uid, skills);
        }
    });
    
    // Auto-resize window after rendering (single RAF, not nested)
    requestAnimationFrame(() => autoResizeWindow());
}

// AUTO-RESIZE VARIABLES
let isResizing = false;
let resizeDebounceTimer = null;
let lastResizeTime = 0;

function autoResizeWindow() {
    if (!window.electronAPI?.resizeWindow) return;
    if (isResizing) return; // Skip if already resizing

    const container = document.querySelector('.meter-container');
    if (!container) return;

    // Clear any pending resize
    if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
    }

    // Debounce to avoid blocking drag - increased from 30ms to 100ms
    resizeDebounceTimer = setTimeout(() => {
        // Get dimensions without forcing reflow (causes flicker)
        const rect = container.getBoundingClientRect();
        const actualHeight = Math.ceil(rect.height);
        const actualWidth = Math.ceil(rect.width);
        
        // Get current window dimensions FIRST (needed for compact mode logic)
        const currentHeight = window.innerHeight;
        const currentWidth = window.innerWidth;
        
        // Different constraints for compact vs full mode
        const isCompact = document.body.classList.contains('compact-mode');
        let targetHeight, targetWidth, finalHeight, finalWidth;
        
        if (isCompact) {
            // Compact mode: FIXED 450px width
            targetHeight = actualHeight + 5;
            finalHeight = Math.max(150, Math.min(targetHeight, 600));
            finalWidth = 450; // FIXED: Always 450px for compact mode
        } else {
            // Full mode: jump to max width immediately, no slow growth
            targetHeight = actualHeight + 10;
            finalHeight = Math.max(250, Math.min(targetHeight, 1200));
            finalWidth = 1000; // FIXED: Always 1000px, no slow growth
        }

        // Only resize if difference is significant (not every pixel)
        const heightDiff = Math.abs(finalHeight - currentHeight);
        const widthDiff = Math.abs(finalWidth - currentWidth);
        
        if (heightDiff > 10 || widthDiff > 10) {
            isResizing = true;
            lastResizeTime = Date.now();
            
            window.electronAPI.resizeWindow(finalWidth, finalHeight);
            
            setTimeout(() => {
                isResizing = false;
            }, 150);
        }
    }, 100); // Debounce increased to 100ms to prevent blocking drag
}

function filterPlayers(players) {
    if (STATE.currentFilter === 'all') return players;
    
    return players.filter(p => {
        const prof = getProfession(p.profession, p);
        return prof.role === STATE.currentFilter;
    });
}

function sortPlayers(players) {
    return [...players].sort((a, b) => {
        const dmgA = a.total_damage?.total || 0;
        const dmgB = b.total_damage?.total || 0;
        return dmgB - dmgA;
    });
}

// ============================================================================
// PLAYER DETAILS MODAL
// ============================================================================

async function openPlayerDetails(uid) {
    try {
        const res = await fetch(`${CONFIG.apiSkill}/${uid}`);
        if (!res.ok) throw new Error('Failed to fetch player details');
        
        const data = await res.json();
        const player = STATE.players.get(uid);
        if (!player) return;
        
        const prof = getProfession(player.profession, player);
        const name = player.name || PLAYER_DB.get(uid) || `Player ${uid}`;
        
        document.getElementById('details-title').textContent = name;
        
        const skills = data.data?.skills || data.skills || {};
        
        document.getElementById('details-body').innerHTML = `
            <div class="details-grid">
                <div class="details-card">
                    <h4>Basic Info</h4>
                    <div class="detail-row">
                        <span class="detail-label">Class:</span>
                        <span class="detail-value">${prof.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Role:</span>
                        <span class="detail-value">${prof.role.toUpperCase()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Haste:</span>
                        <span class="detail-value">${player.haste > 0 ? player.haste : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Mastery:</span>
                        <span class="detail-value">${player.mastery > 0 ? player.mastery : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Gear Score:</span>
                        <span class="detail-value">${formatNumber(player.fightPoint || 0)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Level:</span>
                        <span class="detail-value">${player.attr?.level || 'N/A'}</span>
                    </div>
                </div>
                <div class="details-card">
                    <h4>Combat Stats</h4>
                    <div class="detail-row">
                        <span class="detail-label">Crit Rate:</span>
                        <span class="detail-value">${(player.critRate || 0).toFixed(1)}%</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Lucky Rate:</span>
                        <span class="detail-value">${(player.luckyRate || 0).toFixed(1)}%</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Max Damage:</span>
                        <span class="detail-value">${formatNumber(player.maxDamage || 0)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total DPS:</span>
                        <span class="detail-value">${formatNumber(player.total_dps || 0)}</span>
                    </div>
                </div>
            </div>
            
            <h4 style="margin: 16px 0 8px; font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Skill Breakdown</h4>
            <table class="skills-table">
                <thead>
                    <tr>
                        <th>Skill ID</th>
                        <th>Total DMG</th>
                        <th>Hits</th>
                        <th>Crit%</th>
                        <th>Avg DMG</th>
                    </tr>
                </thead>
                <tbody>
                    ${renderSkillRows(skills)}
                </tbody>
            </table>
            
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn-primary" onclick="copyPlayerToClipboard('${uid}', false)" style="flex: 1;">
                    <i class="fa-solid fa-copy"></i> Copy Stats Only
                </button>
                <button class="btn-primary" onclick="copyPlayerToClipboard('${uid}', true)" style="flex: 1;">
                    <i class="fa-solid fa-copy"></i> Copy with Skills
                </button>
                <button class="btn-secondary" onclick="exportPlayerData('${uid}')" style="flex: 0;">
                    <i class="fa-solid fa-download"></i>
                </button>
            </div>
        `;
        
        document.getElementById('modal-details').classList.add('active');
    } catch (error) {
        console.error('Error loading player details:', error);
    }
}

function renderSkillRows(skills) {
    const entries = Object.entries(skills);
    if (entries.length === 0) {
        return '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No skill data available</td></tr>';
    }
    
    return entries
        .sort((a, b) => b[1].total - a[1].total)
        .map(([skillId, skill]) => {
            const avg = skill.count > 0 ? skill.total / skill.count : 0;
            const critRate = skill.count > 0 ? (skill.critCount / skill.count * 100) : 0;
            
            return `
                <tr>
                    <td>${skillId}</td>
                    <td>${formatNumber(skill.total)}</td>
                    <td>${skill.count}</td>
                    <td>${critRate.toFixed(1)}%</td>
                    <td>${formatNumber(avg)}</td>
                </tr>
            `;
        })
        .join('');
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

function copyToClipboard() {
    // Filter out inactive players (no damage or healing)
    const activePlayers = Array.from(STATE.players.values()).filter(p => {
        const hasDamage = (p.total_damage?.total || 0) > 0;
        const hasHealing = (p.total_healing?.total || 0) > 0;
        return hasDamage || hasHealing;
    });
    
    const players = sortPlayers(activePlayers);
    const duration = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
    
    let text = `⚔️ Infamous BPSR DPS Meter - ${formatDuration(duration)} | ${players.length} Active Players\n\n`;
    text += `═══════════════════════════════════════════════════════════════════════════════════════════\n`;
    text += `Rank  Name              Role    DPS     Total DMG   %   GS    Crit  Mast  Haste  HPS   DMG Taken\n`;
    text += `═══════════════════════════════════════════════════════════════════════════════════════════\n`;
    
    players.forEach((p, idx) => {
        const prof = getProfession(p.profession, p);
        const name = (p.name || PLAYER_DB.get(p.uid) || `Player_${p.uid}`).padEnd(16, ' ').substring(0, 16);
        const role = prof.role.toUpperCase().padEnd(6, ' ');
        const dps = formatNumber(p.total_dps || 0).padStart(7, ' ');
        const totalDmg = formatNumber(p.total_damage?.total || 0).padStart(11, ' ');
        const dmgPercent = ((p.total_damage?.total || 0) / players.reduce((sum, pl) => sum + (pl.total_damage?.total || 0), 1) * 100).toFixed(0).padStart(3, ' ');
        const gs = (p.fightPoint ? formatNumber(p.fightPoint) : '-').padStart(5, ' ');
        const crit = `${(p.critRate || 0).toFixed(0)}%`.padStart(5, ' ');
        const mastery = (p.mastery ? formatNumber(p.mastery) : '-').padStart(5, ' ');
        const haste = (p.haste ? formatNumber(p.haste) : '-').padStart(6, ' ');
        const hps = (prof.role === 'heal' ? formatNumber(p.total_hps || 0) : '-').padStart(5, ' ');
        const dmgTaken = formatNumber(p.taken_damage || 0).padStart(11, ' ');
        
        text += `${String(idx + 1).padStart(2, ' ')}.  ${name} ${role} ${dps} ${totalDmg} ${dmgPercent}% ${gs} ${crit} ${mastery} ${haste} ${hps} ${dmgTaken}\n`;
    });
    
    text += `═══════════════════════════════════════════════════════════════════════════════════════════\n`;
    
    // Use execCommand as fallback for Electron
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        // Copied to clipboard
        // Show a temporary notification instead of alert
        showNotification('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy', 'error');
    } finally {
        document.body.removeChild(textArea);
    }
}

async function copyPlayerToClipboard(uid, includeSkills = false) {
    const player = STATE.players.get(uid);
    if (!player) {
        showNotification('Player not found', 'error');
        return;
    }
    
    const prof = getProfession(player.profession, player);
    const name = player.name || PLAYER_DB.get(uid) || `Player_${uid}`;
    const duration = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
    
    // Get player's rank
    const activePlayers = Array.from(STATE.players.values()).filter(p => {
        const hasDamage = (p.total_damage?.total || 0) > 0;
        const hasHealing = (p.total_healing?.total || 0) > 0;
        return hasDamage || hasHealing;
    });
    const sortedPlayers = sortPlayers(activePlayers);
    const rank = sortedPlayers.findIndex(p => p.uid === uid) + 1;
    const totalDmg = sortedPlayers.reduce((sum, p) => sum + (p.total_damage?.total || 0), 0);
    const contribution = totalDmg > 0 ? ((player.total_damage?.total || 0) / totalDmg * 100).toFixed(1) : '0.0';
    
    let text = `⚔️ ${name} - Rank #${rank} | ${formatDuration(duration)}\n`;
    text += `═══════════════════════════════════════════════════════════════════\n\n`;
    
    text += `📊 Basic Info:\n`;
    text += `  Class: ${prof.name} (${prof.role.toUpperCase()})\n`;
    text += `  Gear Score: ${formatNumber(player.fightPoint || 0)}\n`;
    text += `  Level: ${player.attr?.level || 'N/A'}\n\n`;
    
    text += `⚔️ Combat Stats:\n`;
    text += `  DPS: ${formatNumber(player.total_dps || 0)}\n`;
    text += `  Max DPS: ${formatNumber(player.max_dps || 0)}\n`;
    text += `  Total DMG: ${formatNumber(player.total_damage?.total || 0)} (${contribution}%)\n`;
    text += `  Max Hit: ${formatNumber(player.maxDamage || 0)}\n`;
    text += `  DMG Taken: ${formatNumber(player.taken_damage || 0)}\n\n`;
    
    if (prof.role === 'heal') {
        text += `💚 Healing Stats:\n`;
        text += `  HPS: ${formatNumber(player.total_hps || 0)}\n`;
        text += `  Max HPS: ${formatNumber(player.max_hps || 0)}\n`;
        text += `  Total Healing: ${formatNumber(player.total_healing?.total || 0)}\n\n`;
    }
    
    text += `🎯 Advanced Stats:\n`;
    text += `  Crit Rate: ${(player.critRate || 0).toFixed(1)}%\n`;
    text += `  Lucky Rate: ${(player.luckyRate || 0).toFixed(1)}%\n`;
    text += `  Mastery: ${player.mastery || 'N/A'}\n`;
    text += `  Haste: ${player.haste || 'N/A'}\n`;
    
    // Include skills if requested
    if (includeSkills) {
        try {
            const res = await fetch(`${CONFIG.apiSkill}/${uid}`);
            if (res.ok) {
                const data = await res.json();
                const skills = data.data?.skills || data.skills || {};
                const skillEntries = Object.entries(skills)
                    .filter(([_, skill]) => (skill.totalDamage || 0) > 0) // Only skills with damage
                    .sort((a, b) => (b[1].totalDamage || 0) - (a[1].totalDamage || 0))
                    .slice(0, 10); // Top 10 skills
                
                if (skillEntries.length > 0) {
                    text += `\n\n📜 SKILLS:\n`;
                    text += `${'─'.repeat(80)}\n`;
                    text += `${'SKILL'.padEnd(30)} ${'TOTAL DMG'.padStart(12)} ${'HITS'.padStart(6)} ${'CRIT%'.padStart(7)} ${'AVG DMG'.padStart(10)}\n`;
                    text += `${'─'.repeat(80)}\n`;
                    
                    skillEntries.forEach(([skillId, skill]) => {
                        // Translate skill ID to name
                        const translatedName = skillNamesMap[skillId] || skill.displayName || `Skill ${skillId}`;
                        const skillName = translatedName.length > 28 ? translatedName.substring(0, 28) + '..' : translatedName;
                        const dmg = formatNumber(skill.totalDamage || 0);
                        const hits = String(skill.totalCount || 0);
                        const critRate = ((skill.critRate || 0) * 100).toFixed(1) + '%';
                        const avgDmg = formatNumber(Math.floor((skill.totalDamage || 0) / Math.max(skill.totalCount || 1, 1)));
                        
                        text += `${skillName.padEnd(30)} ${dmg.padStart(12)} ${hits.padStart(6)} ${critRate.padStart(7)} ${avgDmg.padStart(10)}\n`;
                    });
                } else {
                    text += `\n\n📜 SKILLS: No damage recorded\n`;
                }
            }
        } catch (err) {
            console.error('Failed to fetch skills:', err);
            text += `\n\n📜 SKILLS: Error loading data\n`;
        }
    }
    
    text += `\n═══════════════════════════════════════════════════════════════════\n`;
    text += `Generated by Infamous BPSR Meter at ${new Date().toLocaleTimeString()}\n`;
    
    // Copy to clipboard
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        // Copied player data
        showNotification(`Copied ${name}'s stats${includeSkills ? ' with skills' : ''}!`);
    } catch (err) {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy', 'error');
    } finally {
        document.body.removeChild(textArea);
    }
}

function exportAllCSV() {
    // Filter out inactive players
    const activePlayers = Array.from(STATE.players.values()).filter(p => {
        const hasDamage = (p.total_damage?.total || 0) > 0;
        const hasHealing = (p.total_healing?.total || 0) > 0;
        return hasDamage || hasHealing;
    });
    
    const players = sortPlayers(activePlayers);
    const headers = ['Rank', 'Name', 'Class', 'Role', 'GS', 'Current DPS', 'Max DPS', 'Avg DPS', 'Total DMG', '% DMG', 'HPS', 'Max HPS', 'Total Heal', 'DMG Taken', 'Crit%', 'Lucky%', 'Mastery', 'Haste', 'Max Hit'];
    const rows = [headers];
    
    players.forEach((p, idx) => {
        const prof = getProfession(p.profession, p);
        const name = p.name || PLAYER_DB.get(p.uid) || `Player_${p.uid}`;
        const dmgPercent = ((p.total_damage?.total || 0) / players.reduce((sum, pl) => sum + (pl.total_damage?.total || 0), 1) * 100).toFixed(1);
        rows.push([
            idx + 1,
            name,
            prof.name,
            prof.role,
            p.fightPoint || 0,
            p.current_dps || p.realtime_dps || 0,
            p.max_dps || p.realtime_dps_max || 0,
            p.total_dps || 0,
            p.total_damage?.total || 0,
            dmgPercent,
            p.total_hps || 0,
            p.realtime_hps_max || 0,
            p.total_healing?.total || 0,
            p.taken_damage || 0,
            (p.critRate || 0).toFixed(1),
            (p.luckyRate || 0).toFixed(1),
            p.mastery || 0,
            p.haste || 0,
            p.maxDamage || 0,
        ]);
    });
    
    const csv = rows.map(row => row.join(',')).join('\n');
    downloadFile(csv, 'bpsr-meter-all.csv', 'text/csv');
}

function exportAllMarkdown() {
    // Filter out inactive players
    const activePlayers = Array.from(STATE.players.values()).filter(p => {
        const hasDamage = (p.total_damage?.total || 0) > 0;
        const hasHealing = (p.total_healing?.total || 0) > 0;
        return hasDamage || hasHealing;
    });
    
    const players = sortPlayers(activePlayers);
    const duration = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
    
    let md = `# ⚔️ Infamous BPSR DPS Meter Export\n\n`;
    md += `**Duration:** ${formatDuration(duration)}\n`;
    md += `**Active Players:** ${players.length}\n`;
    md += `**Timestamp:** ${new Date().toLocaleString()}\n\n`;
    md += `## Rankings\n\n`;
    md += `| Rank | Name | Class | Role | GS | Current DPS | Max DPS | Avg DPS | Total DMG | % | HPS | Max HPS | Total Heal | DMG Taken | Crit% | Lucky% | Mastery | Haste | Max Hit |\n`;
    md += `|------|------|-------|------|----|-----------|---------|---------|-----------|----|-----|---------|------------|-----------|-------|--------|---------|--------|----------|\n`;
    
    players.forEach((p, idx) => {
        const prof = getProfession(p.profession, p);
        const name = p.name || PLAYER_DB.get(p.uid) || `Player_${p.uid}`;
        const dmgPercent = ((p.total_damage?.total || 0) / players.reduce((sum, pl) => sum + (pl.total_damage?.total || 0), 1) * 100).toFixed(0);
        const currentDps = p.current_dps || p.realtime_dps || 0;
        const maxDps = p.max_dps || p.realtime_dps_max || 0;
        const maxHps = p.realtime_hps_max || 0;
        
        md += `| ${idx + 1} | ${name} | ${prof.name} | ${prof.role} | ${formatNumber(p.fightPoint || 0)} | ${formatNumber(currentDps)} | ${formatNumber(maxDps)} | ${formatNumber(p.total_dps || 0)} | ${formatNumber(p.total_damage?.total || 0)} | ${dmgPercent}% | ${formatNumber(p.total_hps || 0)} | ${formatNumber(maxHps)} | ${formatNumber(p.total_healing?.total || 0)} | ${formatNumber(p.taken_damage || 0)} | ${(p.critRate || 0).toFixed(1)}% | ${(p.luckyRate || 0).toFixed(1)}% | ${formatNumber(p.mastery || 0)} | ${formatNumber(p.haste || 0)} | ${formatNumber(p.maxDamage || 0)} |\n`;
    });
    
    downloadFile(md, 'bpsr-meter-all.md', 'text/markdown');
}

function exportPlayerData(uid) {
    const player = STATE.players.get(uid);
    if (!player) return;
    
    const prof = getProfession(player.profession, player);
    const name = player.name || PLAYER_DB.get(uid) || `Player_${uid}`;
    
    const data = {
        name,
        uid,
        class: prof.name,
        role: prof.role,
        gearScore: player.fightPoint || 0,
        level: player.attr?.level || 0,
        stats: {
            dps: player.total_dps || 0,
            hps: player.total_hps || 0,
            totalDamage: player.total_damage?.total || 0,
            damageTaken: player.taken_damage || 0,
            totalHealing: player.total_healing?.total || 0,
            critRate: player.critRate || 0,
            luckyRate: player.luckyRate || 0,
            maxDamage: player.maxDamage || 0,
        },
        exportTime: new Date().toISOString(),
    };
    
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `bpsr-${name}-${uid}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// DURATION COUNTER
// ============================================================================

function startDurationCounter() {
    if (STATE.durationTimer) clearInterval(STATE.durationTimer);
    
    STATE.durationTimer = setInterval(() => {
        // Don't update timer when paused
        if (isPaused) return;
        
        if (STATE.startTime) {
            const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
            const timeStr = formatDuration(elapsed);
            document.getElementById('duration').textContent = timeStr;
            document.getElementById('compact-duration').textContent = timeStr;
        }
    }, 1000);
}

function stopDurationCounter() {
    if (STATE.durationTimer) {
        clearInterval(STATE.durationTimer);
        STATE.durationTimer = null;
    }
}

// ============================================================================
// AUTO REFRESH
// ============================================================================

function startAutoRefresh() {
    if (STATE.refreshTimer) clearInterval(STATE.refreshTimer);
    
    const interval = SETTINGS.refreshInterval * 1000;
    
    let lastPlayerCount = 0;
    let lastRenderHash = '';
    
    STATE.refreshTimer = setInterval(async () => {
        try {
            const players = await fetchPlayerData();
            const currentCount = players?.length || 0;
            
            // Check if force render needed (every 2 seconds in combat, 5 seconds idle)
            const timeSinceLastUpdate = Date.now() - STATE.lastUpdate;
            const forceRenderInterval = STATE.inCombat ? 2000 : 5000;
            const forceRender = timeSinceLastUpdate > forceRenderInterval;
            
            let shouldRender = forceRender;
            
            // Only calculate hash if player count changed OR force render
            if (!shouldRender && (currentCount !== lastPlayerCount || STATE.inCombat)) {
                // OPTIMIZED: Simplified hash - just sum total damage (much faster)
                const totalDamageSum = Array.from(STATE.players.values())
                    .reduce((sum, p) => sum + (p.total_damage?.total || 0), 0);
                const currentHash = `${STATE.players.size}:${totalDamageSum}`;
                
                shouldRender = currentHash !== lastRenderHash;
                
                if (shouldRender) {
                    lastPlayerCount = currentCount;
                    lastRenderHash = currentHash;
                }
            }
            
            if (shouldRender) {
                STATE.lastUpdate = Date.now();
                lastPlayerCount = currentCount;
                renderPlayers();
            }
        } catch (error) {
            console.error('❌ Failed to fetch player data:', error);
            console.error('❌ Error stack:', error.stack);
            // Update connection status in UI
            const statusElement = document.querySelector('.loading div');
            if (statusElement) {
                statusElement.textContent = `Connection error: ${error.message}`;
            }
        }
    }, interval);
    
    // Refresh skills for expanded players every 1 second for real-time updates during combat
    if (STATE.skillsRefreshTimer) clearInterval(STATE.skillsRefreshTimer);
    STATE.skillsRefreshTimer = setInterval(() => {
        expandedPlayerIds.forEach(uid => {
            loadAndShowPlayerDetails(uid);
        });
    }, 1000);
}

function stopAutoRefresh() {
    if (STATE.refreshTimer) {
        clearInterval(STATE.refreshTimer);
        STATE.refreshTimer = null;
    }
    if (STATE.skillsRefreshTimer) {
        clearInterval(STATE.skillsRefreshTimer);
        STATE.skillsRefreshTimer = null;
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventListeners() {
    // Setting up event listeners...
    
    // Filter tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const newFilter = tab.dataset.filter;
            console.log(`🎯 TAB CLICKED: "${newFilter}" (was "${STATE.currentFilter}")`);
            STATE.currentFilter = newFilter;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderPlayers();
        });
    });
    
    // Header buttons - with explicit event handling
    const settingsBtn = document.getElementById('btn-settings');
    // Settings button found
    if (settingsBtn) {
        settingsBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // CRITICAL: Use popup window if available (v3.1.128+)
            if (window.electronAPI?.openSettingsWindow) {
                window.electronAPI.openSettingsWindow();
                return; // Exit - popup window handles it
            }
            
            // FALLBACK: Use modal (for web/old versions)
            // If in compact mode, temporarily expand window for settings
            const isCompact = document.body.classList.contains('compact-mode');
            if (isCompact && window.electronAPI?.setWindowSize) {
                STATE.tempExpandedForSettings = true;
                await window.electronAPI.setWindowSize(1000, 700);
            }
            
            // Settings modal opening...
            
            // Load current settings
            document.getElementById('setting-highlight').checked = SETTINGS.highlightLocal;
            document.getElementById('setting-refresh').value = SETTINGS.refreshInterval;
            document.getElementById('setting-remember-names').checked = SETTINGS.rememberNames;
            document.getElementById('setting-auto-clear-zone').checked = SETTINGS.autoClearOnZoneChange;
            document.getElementById('setting-keep-after-dungeon').checked = SETTINGS.keepDataAfterDungeon;
            document.getElementById('setting-default-sort').value = SETTINGS.defaultSort || 'totalDmg';
            document.getElementById('setting-auto-update').value = SETTINGS.autoUpdate || 'notify';
            document.getElementById('setting-max-sessions').value = SETTINGS.maxSessions || 20;
            
            // Load opacity slider value
            const opacitySlider = document.getElementById('setting-overlay-opacity');
            const opacityValue = document.getElementById('opacity-value');
            if (opacitySlider && opacityValue) {
                const currentOpacity = SETTINGS.overlayOpacity || 1.0;
                opacitySlider.value = currentOpacity;
                opacityValue.textContent = Math.round(currentOpacity * 100) + '%';
            }
        
        // Load column visibility settings for COMPACT mode
        document.getElementById('setting-col-compact-dps').checked = SETTINGS.columnsCompact.dps;
        document.getElementById('setting-col-compact-max-dps').checked = SETTINGS.columnsCompact.maxDps;
        document.getElementById('setting-col-compact-avg-dps').checked = SETTINGS.columnsCompact.avgDps;
        document.getElementById('setting-col-compact-total-dmg').checked = SETTINGS.columnsCompact.totalDmg;
        document.getElementById('setting-col-compact-hps').checked = SETTINGS.columnsCompact.hps;
        document.getElementById('setting-col-compact-dmg-taken').checked = SETTINGS.columnsCompact.dmgTaken;
        document.getElementById('setting-col-compact-gs').checked = SETTINGS.columnsCompact.gs;
        
        // Load column visibility settings for FULL mode
        document.getElementById('setting-col-full-dps').checked = SETTINGS.columnsFull.dps;
        document.getElementById('setting-col-full-max-dps').checked = SETTINGS.columnsFull.maxDps;
        document.getElementById('setting-col-full-avg-dps').checked = SETTINGS.columnsFull.avgDps;
        document.getElementById('setting-col-full-total-dmg').checked = SETTINGS.columnsFull.totalDmg;
        document.getElementById('setting-col-full-hps').checked = SETTINGS.columnsFull.hps;
        document.getElementById('setting-col-full-dmg-taken').checked = SETTINGS.columnsFull.dmgTaken;
        document.getElementById('setting-col-full-gs').checked = SETTINGS.columnsFull.gs;
        
            const modal = document.getElementById('modal-settings');
            console.log('📋 Opening settings modal:', modal ? 'Found' : 'NOT FOUND');
            if (modal) {
                modal.classList.add('active');
            }
        });
    }
    
    document.getElementById('btn-export')?.addEventListener('click', () => {
        document.getElementById('modal-export').classList.add('active');
    });
    
    document.getElementById('btn-reset')?.addEventListener('click', async () => {
        confirmAction('Reset all DPS data?', async () => {
            try {
                await fetch(CONFIG.apiClear, { method: 'POST' });
                STATE.players.clear();
                
                // Clear skills cache and expanded players
                skillsCache.clear();
                expandedPlayerIds = [];
                
                // Reset timer
                STATE.startTime = null;
                stopDurationCounter();
                document.getElementById('duration').textContent = '00:00';
                document.getElementById('compact-duration').textContent = '00:00';
                
                renderPlayers();
                // CRITICAL: Resize window after clearing data
                setTimeout(() => autoResizeWindow(), 100);
                showToast('All data cleared successfully', 'success');
            } catch (e) {
                console.error('Reset failed:', e);
                showToast('Failed to reset data', 'error');
            }
        });
    });
    
    // View mode toggle
    const compactBtn = document.getElementById('btn-compact');
    if (compactBtn) {
        compactBtn.addEventListener('click', () => {
            STATE.viewMode = STATE.viewMode === 'compact' ? 'detailed' : 'compact';
            const btn = document.getElementById('btn-compact');
            if (btn) {
                btn.title = STATE.viewMode === 'compact' ? 'Switch to Detailed View' : 'Switch to Compact View';
                btn.querySelector('i').className = STATE.viewMode === 'compact' ? 'fa-solid fa-list' : 'fa-solid fa-table-columns';
            }
            
            renderPlayers();
            showNotification(`${STATE.viewMode.charAt(0).toUpperCase() + STATE.viewMode.slice(1)} view enabled`);
        });
    } else {
        console.warn('⚠️ btn-compact not found in DOM');
    }
    
    // Solo mode toggle
    document.getElementById('btn-solo-mode')?.addEventListener('click', () => {
        STATE.soloMode = !STATE.soloMode;
        const btn = document.getElementById('btn-solo-mode');
        const compactBtn = document.getElementById('btn-compact-solo');
        const activeStyle = STATE.soloMode ? 'rgba(251, 191, 36, 0.2)' : '';
        const borderStyle = STATE.soloMode ? 'var(--accent-gold)' : '';
        
        if (btn) {
            btn.style.background = activeStyle;
            btn.style.borderColor = borderStyle;
        }
        if (compactBtn) {
            compactBtn.style.background = activeStyle;
            compactBtn.style.borderColor = borderStyle;
        }
        renderPlayers();
        // CRITICAL: Resize window after solo mode toggle
        setTimeout(() => autoResizeWindow(), 100);
        showNotification(STATE.soloMode ? 'Solo mode enabled' : 'Solo mode disabled');
    });
    
    // Compact Mode (Overlay Mode) toggle
    document.getElementById('btn-compact-mode')?.addEventListener('click', async () => {
        const compactMode = document.body.classList.toggle('compact-mode');
        const btn = document.getElementById('btn-compact-mode');
        
        // Update button tooltip
        if (btn) {
            btn.title = compactMode ? 'Exit Overlay Mode (Full View)' : 'Toggle Overlay Mode (In-Game)';
        }
        
        // Save preference to SETTINGS
        SETTINGS.compactMode = compactMode;
        SETTINGS.save();
        
        // CRITICAL: Resize Electron window to match compact/full mode
        if (window.electronAPI?.setCompactMode) {
            await window.electronAPI.setCompactMode(compactMode);
        }
        
        // Force immediate re-render to update DOM
        renderPlayers();
        
        // Apply or remove scale
        setTimeout(() => {
            applyWindowZoom();
            autoResizeWindow();
        }, 200);
        
        showToast(
            compactMode 
                ? 'Compact Mode: Max 6 players' 
                : 'Full Mode: All players',
            'info',
            2000
        );
    });
    
    // Always on Top toggle
    document.getElementById('btn-always-on-top')?.addEventListener('click', () => {
        STATE.alwaysOnTop = !STATE.alwaysOnTop;
        const btn = document.getElementById('btn-always-on-top');
        if (btn) {
            btn.title = STATE.alwaysOnTop ? 'Always on Top: ON' : 'Always on Top: OFF';
            btn.style.background = STATE.alwaysOnTop ? 'rgba(251, 191, 36, 0.2)' : '';
            btn.style.borderColor = STATE.alwaysOnTop ? 'var(--accent-gold)' : '';
            const icon = btn.querySelector('i');
            if (icon) {
                icon.style.opacity = STATE.alwaysOnTop ? '1' : '0.5';
            }
        }
        if (window.electronAPI?.setAlwaysOnTop) {
            window.electronAPI.setAlwaysOnTop(STATE.alwaysOnTop);
        }
        showToast(`Always on Top ${STATE.alwaysOnTop ? 'enabled' : 'disabled'}`, 'info');
    });
    
    // Click-through mode toggle
    let clickThroughEnabled = false;
    const titleBar = document.querySelector('.title-bar');
    
    document.getElementById('btn-click-through')?.addEventListener('click', () => {
        clickThroughEnabled = !clickThroughEnabled;
        const btn = document.getElementById('btn-click-through');
        if (btn) {
            btn.title = clickThroughEnabled ? 'Click-Through: ON (Click me to disable)' : 'Click-Through Mode: OFF';
            btn.style.background = clickThroughEnabled ? 'rgba(251, 191, 36, 0.2)' : '';
            btn.style.borderColor = clickThroughEnabled ? 'var(--accent-gold)' : '';
        }
        
        // Make title bar always clickable even in click-through mode
        if (titleBar) {
            if (clickThroughEnabled) {
                titleBar.style.pointerEvents = 'auto';
                // Make rest of window click-through
                document.body.style.pointerEvents = 'none';
                titleBar.style.position = 'relative';
                titleBar.style.zIndex = '9999';
            } else {
                titleBar.style.pointerEvents = '';
                document.body.style.pointerEvents = '';
                titleBar.style.position = '';
                titleBar.style.zIndex = '';
            }
        }
        
        if (window.electronAPI?.setClickThrough) {
            window.electronAPI.setClickThrough(clickThroughEnabled);
        }
        showToast(
            clickThroughEnabled 
                ? 'Click-Through ON - Title bar still clickable!' 
                : 'Click-Through OFF', 
            'info',
            3000
        );
    });

    // Transparency adjustment
    let currentOpacity = 1.0;
    document.getElementById('btn-transparency')?.addEventListener('click', () => {
        // Cycle: 100% → 90% → 80% → 70% → 100%
        currentOpacity = currentOpacity > 0.7 ? currentOpacity - 0.1 : 1.0;
        if (window.electronAPI?.setOpacity) {
            window.electronAPI.setOpacity(currentOpacity);
        }
        showToast(`Opacity: ${Math.round(currentOpacity * 100)}%`, 'info');
    });

    document.getElementById('btn-lock')?.addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.toggleLockState();
        }
    });
    
    if (window.electronAPI) {
        window.electronAPI.onLockStateChanged((locked) => {
            const icon = document.querySelector('#btn-lock i');
            if (icon) icon.className = locked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
            
            // Enable click-through when locked in compact mode
            if (locked) {
                document.body.classList.add('locked');
            } else {
                document.body.classList.remove('locked');
            }
        });
    }
    
    // Compact mode reset button
    document.getElementById('btn-compact-reset')?.addEventListener('click', async () => {
        confirmAction('Reset all DPS data?', async () => {
            try {
                await fetch(CONFIG.apiClear, { method: 'POST' });
                
                // Clear local state
                STATE.players.clear();
                
                // Clear skills cache and expanded players
                skillsCache.clear();
                expandedPlayerIds = [];
                
                // Reset timer
                STATE.startTime = null;
                stopDurationCounter();
                document.getElementById('duration').textContent = '00:00';
                document.getElementById('compact-duration').textContent = '00:00';
                
                renderPlayers();
                // CRITICAL: Resize window after clearing data
                setTimeout(() => autoResizeWindow(), 100);
                showToast('All data cleared successfully', 'success');
            } catch (e) {
                console.error('Reset failed:', e);
                showToast('Failed to reset data', 'error');
            }
        });
    });
    
    // Expand/Collapse player list in compact mode (Show All in compact)
    document.getElementById('btn-expand-list')?.addEventListener('click', () => {
        STATE.showingAllPlayers = !STATE.showingAllPlayers;
        renderPlayers();
        showToast(STATE.showingAllPlayers ? 'Showing All Players' : 'Showing Top Players', 'info', 1000);
    });
    
    // Show More button in header (for full mode)
    document.getElementById('btn-show-more')?.addEventListener('click', () => {
        STATE.showingAllPlayers = !STATE.showingAllPlayers;
        renderPlayers();
    });
    
    // Full mode healer toggle
    document.getElementById('btn-healer-mode')?.addEventListener('click', () => {
        SETTINGS.fullHealerMode = !SETTINGS.fullHealerMode;
        SETTINGS.save();
        
        const btn = document.getElementById('btn-healer-mode');
        if (btn) {
            const activeStyle = SETTINGS.fullHealerMode ? 'rgba(34, 197, 94, 0.2)' : '';
            const borderStyle = SETTINGS.fullHealerMode ? 'var(--accent-healing)' : '';
            btn.style.background = activeStyle;
            btn.style.borderColor = borderStyle;
            btn.title = SETTINGS.fullHealerMode ? 'Switch to DPS Mode' : 'Switch to Healer Mode (Show HPS/Healing)';
        }
        
        renderPlayers();
        showToast(SETTINGS.fullHealerMode ? 'Healer Mode: Showing HPS/Healing' : 'DPS Mode: Showing DPS/Damage', 'info', 2000);
    });
    
    // Compact mode button handlers (mirror main buttons)
    document.getElementById('btn-compact-pause')?.addEventListener('click', async () => {
        await togglePause();
    });
    
    document.getElementById('btn-compact-solo')?.addEventListener('click', () => {
        document.getElementById('btn-solo-mode')?.click();
    });
    
    document.getElementById('btn-compact-copy')?.addEventListener('click', () => {
        copyToClipboard();
    });
    
    // Compact mode healer toggle
    document.getElementById('btn-compact-healer')?.addEventListener('click', () => {
        SETTINGS.compactHealerMode = !SETTINGS.compactHealerMode;
        SETTINGS.save();
        
        const btn = document.getElementById('btn-compact-healer');
        const activeStyle = SETTINGS.compactHealerMode ? 'rgba(34, 197, 94, 0.2)' : '';
        const borderStyle = SETTINGS.compactHealerMode ? 'var(--accent-healing)' : '';
        
        if (btn) {
            btn.style.background = activeStyle;
            btn.style.borderColor = borderStyle;
            btn.title = SETTINGS.compactHealerMode ? 'Switch to DPS Mode' : 'Switch to Healer Mode (Show HPS/Healing)';
        }
        
        renderPlayers();
        showToast(SETTINGS.compactHealerMode ? 'Healer Mode: Showing HPS/Healing' : 'DPS Mode: Showing DPS/Damage', 'info', 2000);
    });
    
    // Compact mode zoom in/out (now uses window zoom, not CSS transform)
    document.getElementById('btn-compact-zoom-in')?.addEventListener('click', () => {
        SETTINGS.compactScale = Math.min(150, SETTINGS.compactScale + 10);
        SETTINGS.save();
        applyWindowZoom();
        showToast(`Zoom: ${SETTINGS.compactScale}%`, 'info', 1000);
    });
    
    document.getElementById('btn-compact-zoom-out')?.addEventListener('click', () => {
        SETTINGS.compactScale = Math.max(70, SETTINGS.compactScale - 10);
        SETTINGS.save();
        applyWindowZoom();
        showToast(`Zoom: ${SETTINGS.compactScale}%`, 'info', 1000);
    });
    
    // Minimize button
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.minimizeWindow();
        }
    });
    
    // Pause button
    document.getElementById('btn-pause')?.addEventListener('click', async () => {
        console.log('⏸️ Pause button clicked!');
        await togglePause();
    });
    
    document.getElementById('btn-close')?.addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.closeWindow();
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', async () => {
            const modal = btn.closest('.modal');
            modal.classList.remove('active');
            
            // If we temporarily expanded for settings, restore compact size
            if (modal.id === 'modal-settings' && STATE.tempExpandedForSettings) {
                STATE.tempExpandedForSettings = false;
                // Small delay to let modal close animation finish
                setTimeout(() => autoResizeWindow(), 100);
            }
        });
    });
    
    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Export buttons
    document.getElementById('export-copy')?.addEventListener('click', () => {
        copyToClipboard();
        // Don't close modal immediately so user sees the success message
        setTimeout(() => {
            document.getElementById('modal-export').classList.remove('active');
        }, 1500);
    });
    
    document.getElementById('export-all-csv')?.addEventListener('click', () => {
        exportAllCSV();
        document.getElementById('modal-export').classList.remove('active');
    });
    
    document.getElementById('export-all-md')?.addEventListener('click', () => {
        exportAllMarkdown();
        document.getElementById('modal-export').classList.remove('active');
    });
    
    // Manual name save
    document.getElementById('btn-save-my-name')?.addEventListener('click', () => {
        const nameInput = document.getElementById('setting-my-name');
        const myName = nameInput.value.trim();
        
        if (!myName) {
            showNotification('Please enter your character name', 'error');
            return;
        }
        
        // Find local player UID from current data
        const localPlayer = Array.from(STATE.players.values()).find(p => p.isLocalPlayer);
        
        if (localPlayer) {
            PLAYER_DB.add(localPlayer.uid, myName);
            showNotification(`Saved name: ${myName} for UID ${localPlayer.uid}`);
            renderPlayers(); // Refresh to show new name
        } else if (STATE.localPlayerUid) {
            PLAYER_DB.add(STATE.localPlayerUid, myName);
            showNotification(`Saved name: ${myName} for UID ${STATE.localPlayerUid}`);
        } else {
            // Save for next time we detect local player
            localStorage.setItem('bpsr-my-pending-name', myName);
            showNotification('Name saved! Will be applied when you enter combat.');
        }
        
        nameInput.value = '';
    });
    
    // Save settings
    document.getElementById('save-settings').addEventListener('click', () => {
        // General settings
        SETTINGS.highlightLocal = document.getElementById('setting-highlight').checked;
        SETTINGS.rememberNames = document.getElementById('setting-remember-names').checked;
        SETTINGS.autoClearOnZoneChange = document.getElementById('setting-auto-clear-zone').checked;
        SETTINGS.keepDataAfterDungeon = document.getElementById('setting-keep-after-dungeon').checked;
        const refreshVal = document.getElementById('setting-refresh').value;
        SETTINGS.refreshInterval = parseFloat(refreshVal) || 1.5;
        
        // Auto-update setting
        const autoUpdateVal = document.getElementById('setting-auto-update').value;
        SETTINGS.autoUpdate = autoUpdateVal;
        
        // Max sessions setting
        const maxSessionsVal = parseInt(document.getElementById('setting-max-sessions').value);
        SETTINGS.maxSessions = Math.max(10, Math.min(100, maxSessionsVal || 20)); // Clamp between 10-100
        
        // Default ranking metric
        const defaultSortVal = document.getElementById('setting-default-sort').value;
        SETTINGS.defaultSort = defaultSortVal;
        currentSort.column = defaultSortVal; // Apply immediately
        
        // Overlay settings (from "Overlay" tab)
        SETTINGS.showGS = document.getElementById('setting-show-gs')?.checked ?? true;
        
        // PHASE 3: Opacity control
        const opacityVal = document.getElementById('setting-overlay-opacity')?.value;
        if (opacityVal) {
            SETTINGS.overlayOpacity = parseFloat(opacityVal) || 0.95;
            if (window.electronAPI?.setOverlayOpacity) {
                window.electronAPI.setOverlayOpacity(SETTINGS.overlayOpacity);
            }
        }
        
        // Save column visibility for COMPACT mode
        SETTINGS.columnsCompact.dps = document.getElementById('setting-col-compact-dps').checked;
        SETTINGS.columnsCompact.maxDps = document.getElementById('setting-col-compact-max-dps').checked;
        SETTINGS.columnsCompact.avgDps = document.getElementById('setting-col-compact-avg-dps').checked;
        SETTINGS.columnsCompact.totalDmg = document.getElementById('setting-col-compact-total-dmg').checked;
        SETTINGS.columnsCompact.hps = document.getElementById('setting-col-compact-hps').checked;
        SETTINGS.columnsCompact.dmgTaken = document.getElementById('setting-col-compact-dmg-taken').checked;
        SETTINGS.columnsCompact.gs = document.getElementById('setting-col-compact-gs').checked;
        
        // Save column visibility for FULL mode
        SETTINGS.columnsFull.dps = document.getElementById('setting-col-full-dps').checked;
        SETTINGS.columnsFull.maxDps = document.getElementById('setting-col-full-max-dps').checked;
        SETTINGS.columnsFull.avgDps = document.getElementById('setting-col-full-avg-dps').checked;
        SETTINGS.columnsFull.totalDmg = document.getElementById('setting-col-full-total-dmg').checked;
        SETTINGS.columnsFull.hps = document.getElementById('setting-col-full-hps').checked;
        SETTINGS.columnsFull.dmgTaken = document.getElementById('setting-col-full-dmg-taken').checked;
        SETTINGS.columnsFull.gs = document.getElementById('setting-col-full-gs').checked;
        
        SETTINGS.save();
        
        // Apply new refresh interval
        stopAutoRefresh();
        startAutoRefresh();
        
        // Re-render
        renderPlayers();
        
        // Resize after settings change
        autoResizeWindow();
        
        showNotification('Settings saved successfully');
        document.getElementById('modal-settings').classList.remove('active');
    });
    
    // REMOVED: Old event delegation handler - now using per-row click handlers in renderPlayers()
    
    // PHASE 3: Initialize opacity from settings
    if (SETTINGS.overlayOpacity && window.electronAPI?.setOverlayOpacity) {
        window.electronAPI.setOverlayOpacity(SETTINGS.overlayOpacity);
    }
}

// ============================================================================
// WINDOW ZOOM - GLOBAL FUNCTION
// ============================================================================

// CRITICAL FIX: Apply window zoom by RESIZING window, not zooming content
function applyWindowZoom() {
    const isCompactMode = document.body.classList.contains('compact-mode');
    const zoomLevel = isCompactMode ? SETTINGS.compactScale : SETTINGS.fullModeScale;
    
    // FIXED: Resize the window instead of zooming content
    if (window.electronAPI?.resizeWindow) {
        const baseWidth = isCompactMode ? 450 : 1000;
        const baseHeight = window.innerHeight;
        
        // Calculate scaled dimensions
        const scaledWidth = Math.round(baseWidth * (zoomLevel / 100));
        const scaledHeight = Math.round(baseHeight * (zoomLevel / 100));
        
        window.electronAPI.resizeWindow(scaledWidth, scaledHeight);
        console.log(`🔍 Window resized to ${zoomLevel}%: ${scaledWidth}x${scaledHeight}`);
    } else {
        console.warn('⚠️ electronAPI.resizeWindow not available');
    }
}

// ============================================================================
// FILE LOGGING SYSTEM
// ============================================================================

const LOG_BUFFER = [];
let logEnabled = true;

function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    
    if (logEnabled) {
        LOG_BUFFER.push(logLine);
        
        // Keep only last 1000 lines
        if (LOG_BUFFER.length > 1000) {
            LOG_BUFFER.shift();
        }
        
        // Don't auto-save - only save when manually called
        // Auto-save can break Electron's rendering
    }
}

async function saveLogsToFile() {
    try {
        const logContent = LOG_BUFFER.join('\n');
        const blob = new Blob([logContent], { type: 'text/plain' });
        
        // Try to save via download (will save to Downloads folder)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bpsr-debug.log';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to save logs:', error);
    }
}

// Make saveLogsToFile available globally for manual export
window.saveDebugLogs = saveLogsToFile;

// ============================================================================
// VPN COMPATIBILITY WARNING
// ============================================================================

function checkVPNCompatibility() {
    // This runs once on startup to inform users about VPN issues
    // VPNs can encrypt/redirect packets causing:
    // 1. No data captured at all (encrypted before we see it)
    // 2. Incomplete data (some packets missing)
    // 3. Wrong adapter selected (traffic on VPN adapter, not game adapter)
    // 4. DELAYED STARTUP: Packet capture may take up to 2 minutes to start
    
    // Check if user has previously acknowledged VPN warning
    const acknowledged = localStorage.getItem('bpsr-vpn-warning-seen-v2');
    
    // Don't show on every startup - only if they haven't seen updated version
    if (acknowledged === 'true') {
        return; // User already knows
    }
    
    // Show VPN compatibility notice on first launch
    setTimeout(() => {
        showToast(
            '⚠️ VPN Users: Packet capture may be delayed up to 2 minutes. ' +
            'If no data appears, try disabling VPN and restarting the app.',
            'warning',
            8000 // 8 seconds
        );
        
        localStorage.setItem('bpsr-vpn-warning-seen-v2', 'true');
    }, 3000); // Show after 3 seconds (after main UI loads)
}

function showVPNTroubleshooting() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'vpn-troubleshooting-modal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">⚠️ VPN Compatibility & Troubleshooting</h3>
                <button class="modal-close" onclick="document.getElementById('vpn-troubleshooting-modal').remove()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body" style="max-height: 500px; overflow-y: auto; line-height: 1.6;">
                <h4 style="color: var(--accent-gold); margin-top: 0;">VPN Impact on Packet Capture</h4>
                <p style="color: var(--text-secondary); font-size: 13px;">
                    VPNs encrypt and redirect network traffic, which can interfere with the DPS meter's packet capture.
                </p>
                
                <h4 style="color: var(--accent-gold); margin-top: 16px;">Common Issues:</h4>
                <ul style="color: var(--text-secondary); font-size: 13px; margin: 8px 0;">
                    <li><strong>Delayed Startup:</strong> Packet capture may take <strong>up to 2 minutes</strong> to begin</li>
                    <li><strong>No Data:</strong> Encrypted packets may not be visible to the meter</li>
                    <li><strong>Incomplete Data:</strong> Some packets may be missed or redirected</li>
                    <li><strong>Wrong Adapter:</strong> Auto-detection may select VPN adapter instead of game adapter</li>
                </ul>
                
                <h4 style="color: var(--accent-gold); margin-top: 16px;">VPN Compatibility:</h4>
                <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; margin: 8px 0;">
                    <div style="margin-bottom: 8px;">
                        <strong style="color: var(--accent-green);">✅ Partial Support:</strong>
                        <span style="color: var(--text-secondary); font-size: 13px;">ExitLag (Legacy-NDIS mode) - 70-80% accuracy</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong style="color: var(--accent-red);">❌ Not Compatible:</strong>
                        <span style="color: var(--text-secondary); font-size: 13px;">Kernel-level VPNs (packets encrypted before capture)</span>
                    </div>
                    <div>
                        <strong style="color: var(--accent-green);">✅ Recommended:</strong>
                        <span style="color: var(--text-secondary); font-size: 13px;">Disable VPN for 100% accuracy</span>
                    </div>
                </div>
                
                <h4 style="color: var(--accent-gold); margin-top: 16px;">Troubleshooting Steps:</h4>
                <ol style="color: var(--text-secondary); font-size: 13px; margin: 8px 0; padding-left: 20px;">
                    <li><strong>Wait 2 minutes:</strong> VPN users may experience delayed packet capture startup</li>
                    <li><strong>Test without VPN:</strong> Disable VPN temporarily and restart the meter</li>
                    <li><strong>Compare results:</strong> If meter works without VPN, the VPN is causing interference</li>
                    <li><strong>Change instance:</strong> Switch game channels/instances once to trigger capture</li>
                    <li><strong>Check adapter:</strong> Ensure correct network adapter is selected (Settings → Network Adapter)</li>
                    <li><strong>Restart app:</strong> Close and reopen meter as Administrator</li>
                </ol>
                
                <h4 style="color: var(--accent-gold); margin-top: 16px;">For Best Results:</h4>
                <div style="background: rgba(102, 126, 234, 0.2); padding: 12px; border-radius: 6px; border-left: 3px solid var(--accent-gold);">
                    <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">
                        <strong>💡 Recommendation:</strong> Disable VPN while using the DPS meter for 100% accuracy.
                        You can re-enable it after your combat session.
                    </p>
                </div>
                
                <p style="color: var(--text-muted); font-size: 11px; margin-top: 16px; font-style: italic;">
                    Note: VPN compatibility is experimental and depends on your specific VPN configuration.
                </p>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button class="btn-primary" onclick="document.getElementById('vpn-troubleshooting-modal').remove()" style="padding: 8px 16px; font-size: 13px;">
                    <i class="fa-solid fa-check"></i> Got It
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// OLD VPN detection code - replaced with simpler warning system
async function checkVPNCompatibilityOLD() {
    try {
        const res = await fetch(`${CONFIG.apiBase}/vpn/detect`);
        if (!res.ok) return; // Silently fail if VPN detection not available
        
        const result = await res.json();
        if (result.code !== 0) return;
        
        const { detection, guidance } = result.data;
        
        // Show warning if problematic VPN detected
        if (detection.hasProblematicVPN && guidance.type === 'warning') {
            showVPNWarning(guidance);
        } else if (detection.compatibleVPNs && detection.compatibleVPNs.length > 0) {
            console.log('✅ Compatible VPN detected:', detection.compatibleVPNs.map(v => v.name).join(', '));
        }
    } catch (error) {
        console.warn('VPN detection unavailable:', error.message);
    }
}

function showVPNWarning(guidance) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal vpn-warning-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: var(--bg-dark);
            border: 2px solid var(--accent-gold);
            border-radius: 12px;
            padding: 32px;
            max-width: 500px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        ">
            <h2 style="
                margin: 0 0 16px;
                color: var(--accent-gold);
                font-size: 20px;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                ${guidance.title}
            </h2>
            <p style="
                margin: 0 0 24px;
                color: var(--text-primary);
                line-height: 1.6;
                white-space: pre-line;
            ">${guidance.message}</p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${guidance.actions.map(action => `
                    <button 
                        class="btn-${action.action === 'dismiss' ? 'secondary' : 'primary'}" 
                        onclick="handleVPNAction('${action.action}')"
                        style="flex: 1; min-width: 120px;"
                    >
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

window.handleVPNAction = function(action) {
    const modal = document.querySelector('.vpn-warning-modal');
    
    switch (action) {
        case 'show_vpn_docs':
            // Open VPN compatibility documentation
            window.open('https://github.com/YOUR_REPO/blob/main/VPN-COMPATIBILITY.md', '_blank');
            break;
        case 'dismiss':
            // Just close the modal
            break;
    }
    
    if (modal) {
        modal.remove();
    }
}

// INITIALIZATION
// ============================================================================

// CRITICAL: Detect popup mode from query parameters
async function checkPopupMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const popup = urlParams.get('popup');
    
    if (popup === 'settings') {
        console.log('🪟 POPUP MODE: Settings window detected');
        
        // CRITICAL: Load settings first
        await SETTINGS.load();
        console.log('✅ Settings loaded for popup');
        
        // Hide main app container
        document.querySelector('.meter-container').style.display = 'none';
        
        // Show settings modal
        const settingsModal = document.getElementById('modal-settings');
        if (settingsModal) {
            // Remove modal overlay background
            settingsModal.style.background = 'none';
            settingsModal.style.display = 'flex';
            settingsModal.style.alignItems = 'flex-start';
            settingsModal.style.justifyContent = 'center';
            settingsModal.style.padding = '0';
            
            // Show modal content directly
            const modalContent = settingsModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.margin = '0';
                modalContent.style.maxHeight = 'none';
            }
            
            // Populate settings form fields
            loadSettingsIntoForm();
        }
        return true;
    }
    
    if (popup === 'session-manager') {
        console.log('🪟 POPUP MODE: Session Manager window detected');
        
        // Hide main app container
        document.querySelector('.meter-container').style.display = 'none';
        
        // Load session manager after a brief delay to ensure DOM is ready
        setTimeout(() => {
            openSessionManager();
            
            // Style the modal for popup display
            const sessionModal = document.getElementById('modal-session-manager');
            if (sessionModal) {
                sessionModal.style.background = 'none';
                sessionModal.style.display = 'flex';
                sessionModal.style.alignItems = 'flex-start';
                sessionModal.style.justifyContent = 'center';
                sessionModal.style.padding = '0';
                
                const modalContent = sessionModal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.margin = '0';
                    modalContent.style.maxHeight = 'none';
                }
            }
        }, 100);
        return true;
    }
    
    return false;
}

// Check for Updates Function with Visual Feedback (for index.html)
async function checkForUpdates() {
    const button = event?.target?.closest('button');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
    }
    
    try {
        const response = await fetch('https://api.github.com/repos/ssalihsrz/InfamousBPSRDPSMeter/releases/latest');
        const data = await response.json();
        
        const latestVersion = data.tag_name.replace('v', '');
        const currentVersion = '3.1.182';
        
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

async function initialize() {
    console.log('🚀 Infamous BPSR DPS Meter v3.1.182 - Initializing...');
    
    // CRITICAL: Check if this is a popup window
    const isPopup = await checkPopupMode();
    if (isPopup) {
        console.log('✅ Popup mode initialized, skipping main app setup');
        return; // Don't initialize main app in popup mode
    }
    
    // Check VPN compatibility on startup
    checkVPNCompatibility();
    
    // Load persistent data (await settings from AppData)
    await SETTINGS.load();
    PLAYER_DB.load();
    
    // Restore compact mode preference
    const savedCompactMode = SETTINGS.compactMode;
    if (savedCompactMode) {
        document.body.classList.add('compact-mode');
        const btn = document.getElementById('btn-compact-mode');
        if (btn) {
            btn.title = 'Exit Overlay Mode (Full View)';
        }
        // Resize window to compact mode on startup
        if (window.electronAPI?.setCompactMode) {
            await window.electronAPI.setCompactMode(true);
        }
    }
    
    // Restore healer mode preference for compact view
    if (SETTINGS.compactHealerMode) {
        const healerBtn = document.getElementById('btn-compact-healer');
        if (healerBtn) {
            healerBtn.style.background = 'rgba(34, 197, 94, 0.2)';
            healerBtn.style.borderColor = 'var(--accent-healing)';
            healerBtn.title = 'Switch to DPS Mode';
        }
    }
    
    // Restore healer mode preference for full mode
    if (SETTINGS.fullHealerMode) {
        const healerBtn = document.getElementById('btn-healer-mode');
        if (healerBtn) {
            healerBtn.style.background = 'rgba(34, 197, 94, 0.2)';
            healerBtn.style.borderColor = 'var(--accent-healing)';
            healerBtn.title = 'Switch to DPS Mode';
        }
    }
    
    // Apply window zoom on startup
    setTimeout(() => applyWindowZoom(), 100);
    
    // Sync pause state from backend - NO forced unpause (was causing startup delay)
    try {
        const res = await fetch(CONFIG.apiPause);
        const data = await res.json();
        isPaused = data.paused || false;
        
        const btn = document.getElementById('btn-pause');
        const icon = btn?.querySelector('i');
        if (btn && icon) {
            icon.className = isPaused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
            btn.title = isPaused ? 'Resume' : 'Pause';
        }
    } catch (e) {
        console.warn('Could not sync pause state:', e);
        isPaused = false;
        const btn = document.getElementById('btn-pause');
        const icon = btn?.querySelector('i');
        if (btn && icon) {
            icon.className = 'fa-solid fa-pause';
            btn.title = 'Pause';
        }
    }
    
    // Setup UI
    setupEventListeners();
    initializeSessionManagement(); // Add session management
    
    // Initial fetch
    await fetchPlayerData();
    renderPlayers();
    
    // Initial resize after loading
    autoResizeWindow();
    
    // Start auto-refresh (unless paused)
    if (!isPaused) {
        startAutoRefresh();
    }
    
    console.log('✅ Infamous BPSR DPS Meter v3.1.182 - Ready!');
}

// ============================================================================
// AUTO-UPDATER EVENT HANDLERS
// ============================================================================

if (window.electronAPI) {
    // Update available notification
    window.electronAPI.onUpdateAvailable((info) => {
        const notification = document.getElementById('update-notification');
        const versionInfo = document.getElementById('update-version-info');
        
        if (notification && versionInfo) {
            versionInfo.textContent = `Version ${info.newVersion} is available (current: ${info.currentVersion})`;
            notification.style.display = 'block';
        }
    });
    
    // Download progress
    window.electronAPI.onUpdateDownloadProgress((progress) => {
        const progressModal = document.getElementById('download-progress');
        const progressBar = document.getElementById('download-progress-bar');
        const progressText = document.getElementById('download-progress-text');
        
        if (progressModal && progressBar && progressText) {
            progressModal.style.display = 'block';
            progressBar.style.width = progress.percent + '%';
            progressText.textContent = Math.round(progress.percent) + '%';
        }
        
        // Hide update notification once download starts
        const notification = document.getElementById('update-notification');
        if (notification) notification.style.display = 'none';
    });
    
    // Update downloaded and ready
    window.electronAPI.onUpdateDownloaded((info) => {
        // Hide download progress
        const progressModal = document.getElementById('download-progress');
        if (progressModal) progressModal.style.display = 'none';
        
        // Show update ready modal
        const readyModal = document.getElementById('update-ready');
        if (readyModal) readyModal.style.display = 'block';
    });
    
    // Update error
    window.electronAPI.onUpdateError((error) => {
        showToast(error.message, 'error', 5000);
        
        // Hide all update modals
        const notification = document.getElementById('update-notification');
        const progressModal = document.getElementById('download-progress');
        if (notification) notification.style.display = 'none';
        if (progressModal) progressModal.style.display = 'none';
    });
}

// ============================================================================
// AUTO-UPDATER BUTTON HANDLERS
// ============================================================================

document.getElementById('btn-download-update')?.addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.downloadUpdate();
    }
});

document.getElementById('btn-view-release')?.addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.openReleasePage();
    }
});

document.getElementById('btn-dismiss-update')?.addEventListener('click', () => {
    const notification = document.getElementById('update-notification');
    if (notification) notification.style.display = 'none';
});

document.getElementById('btn-install-now')?.addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.installUpdate();
    }
});

document.getElementById('btn-install-later')?.addEventListener('click', () => {
    const readyModal = document.getElementById('update-ready');
    if (readyModal) readyModal.style.display = 'none';
    showToast('Update will be installed when you close the app', 'info', 3000);
});

// ============================================================================
// TOAST NOTIFICATION SYSTEM - NO MORE BROWSER ALERTS!
// ============================================================================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = document.createElement('i');
    icon.className = getToastIcon(type);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageDiv);
    container.appendChild(toast);
    
    // Auto-dismiss
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function getToastIcon(type) {
    const icons = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-exclamation',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info'
    };
    return icons[type] || icons.info;
}

// Backward compatibility
function showNotification(message, type = 'success') {
    showToast(message, type);
}

// Replace confirm() dialogs
function confirmAction(message, onConfirm, onCancel = null) {
    const container = document.getElementById('toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-warning';
    toast.style.cssText = 'cursor:pointer;padding:16px 20px;border:2px solid var(--accent-gold);';
    
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-triangle-exclamation';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.innerHTML = `<strong>${message}</strong><br><small style="opacity:0.8">Click anywhere to CONFIRM or X to cancel</small>`;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    cancelBtn.style.cssText = 'background:rgba(255,255,255,0.1);border:none;color:#fff;cursor:pointer;margin-left:auto;padding:8px 12px;border-radius:4px;font-size:16px;';
    cancelBtn.onmouseover = () => cancelBtn.style.background = 'rgba(255,255,255,0.2)';
    cancelBtn.onmouseout = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        toast.remove();
        if (onCancel) onCancel();
    };
    
    toast.appendChild(icon);
    toast.appendChild(messageDiv);
    toast.appendChild(cancelBtn);
    container.appendChild(toast);
    
    toast.addEventListener('click', () => {
        toast.remove();
        onConfirm();
        showToast('Action confirmed', 'success');
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 10000);
}

// ============================================================================
// INLINE PLAYER DETAILS (NO POPUP)
// ============================================================================

let expandedPlayerIds = []; // Track up to 2 expanded players

function togglePlayerDetails(uid, event) {
    console.log('🔄 Toggle details for UID:', uid);
    
    const index = expandedPlayerIds.indexOf(uid);
    
    if (index !== -1) {
        // Collapse this player
        expandedPlayerIds.splice(index, 1);
        renderPlayers();
        // Resize after collapse
        setTimeout(() => autoResizeWindow(), 100);
    } else {
        // Expand this player
        expandedPlayerIds.push(uid);
        
        // MAX 2 EXPANDED: Remove oldest if we have 3
        if (expandedPlayerIds.length > 2) {
            expandedPlayerIds.shift(); // Remove first (oldest)
        }
        
        renderPlayers(); // Show expanded state with "Loading..."
        
        // Check if player has saved skills data (from loaded session)
        const player = STATE.players.get(uid);
        if (player && player.skills && Object.keys(player.skills).length > 0) {
            // Use saved skills data
            console.log(`✅ Using saved skills data for UID ${uid}`);
            displaySkillsFromSavedData(uid, player.skills);
        } else {
            // Fetch live skills data
            loadAndShowPlayerDetails(uid).catch(err => {
                console.error(`❌ Failed to load skills for ${uid}:`, err);
            });
        }
    }
}

// Cache skills data to prevent re-fetching on every render
const skillsCache = new Map();

// Load skill names mapping
let skillNamesMap = {};
fetch('/tables/skill_names.json')
    .then(res => res.json())
    .then(data => {
        skillNamesMap = data.skill_names || {};
        console.log(`✅ Loaded ${Object.keys(skillNamesMap).length} skill name translations`);
    })
    .catch(err => console.error('Failed to load skill names:', err));

function renderSkillsTable(uid, top10) {
    const skillsContainer = document.getElementById(`skills-${uid}`);
    if (!skillsContainer) return;
    
    skillsContainer.innerHTML = `
        <table class="skills-table">
            <thead>
                <tr>
                    <th>Skill</th>
                    <th>Total DMG</th>
                    <th>Hits</th>
                    <th>Crit%</th>
                    <th>Avg DMG</th>
                </tr>
            </thead>
            <tbody>
                ${top10.map(skill => {
                    const avg = skill.count > 0 ? skill.total / skill.count : 0;
                    const critPercent = ((skill.critRate || 0) * 100).toFixed(1);
                    
                    // Translate skill name using mapping
                    let skillName = skillNamesMap[skill.id] || skill.displayName || `Skill ${skill.id}`;
                    
                    return `
                        <tr>
                            <td>${skillName}</td>
                            <td>${formatNumber(skill.total)}</td>
                            <td>${skill.count}</td>
                            <td>${critPercent}%</td>
                            <td>${formatNumber(avg)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        
        <div style="display: flex; gap: 8px; margin-top: 12px; justify-content: center;">
            <button class="btn-secondary" onclick="copyPlayerToClipboard(${uid}, false)" style="font-size: 11px; padding: 6px 12px;">
                <i class="fa-solid fa-copy"></i> Copy Stats Only
            </button>
            <button class="btn-secondary" onclick="copyPlayerToClipboard(${uid}, true)" style="font-size: 11px; padding: 6px 12px;">
                <i class="fa-solid fa-clipboard-list"></i> Copy with Skills
            </button>
        </div>
    `;
}

function renderSkillsFromCache(uid) {
    const cached = skillsCache.get(uid);
    if (cached) {
        renderSkillsTable(uid, cached);
        // Resize window after rendering cached skills
        setTimeout(() => autoResizeWindow(), 100);
    }
}

async function loadAndShowPlayerDetails(uid) {
    try {
        const apiUrl = `${CONFIG.apiSkill}/${uid}`;
        
        // Add 5 second timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            throw new Error(`Failed to fetch player details: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data || data.code !== 0) {
            throw new Error(data?.msg || 'Invalid API response');
        }
        
        const skills = data.data?.skills || data.skills || {};
        
        // Convert to array and sort by total damage
        const skillArray = Object.entries(skills).map(([id, skill]) => {
            return {
                id,
                ...skill,
                total: skill.totalDamage || skill.total || 0,
                count: skill.totalCount || skill.count || 0,
                critRate: skill.critRate || 0
            };
        });
        
        skillArray.sort((a, b) => b.total - a.total);
        const top10 = skillArray.slice(0, 10);
        
        // Only log when successfully loaded
        console.log(`✅ Loaded ${skillArray.length} skills for UID ${uid}`);
        
        // Render top 10 skills (includes imagine skills)
        const skillsContainer = document.getElementById(`skills-${uid}`);
        
        if (!skillsContainer) {
            return;
        }
        
        if (top10.length === 0) {
            skillsContainer.innerHTML = '<div class="no-data" style="padding:20px;text-align:center;color:#9ca3af;">No skill data yet - deal some damage first!</div>';
            return;
        }
        
        // Cache the skills data
        skillsCache.set(uid, top10);
        
        // Render skills table
        renderSkillsTable(uid, top10);
        
        // Resize window after skills are loaded and rendered
        setTimeout(() => autoResizeWindow(), 100);
    } catch (error) {
        // Don't spam error toasts - players zoning/changing maps causes temporary API failures
        console.warn(`⚠️ Could not load skills for UID ${uid}:`, error.message);
        const skillsContainer = document.getElementById(`skills-${uid}`);
        if (skillsContainer) {
            // Show appropriate message based on error type
            const message = error.name === 'AbortError' 
                ? 'Skill data loading timed out - try again' 
                : 'Skill data unavailable';
            skillsContainer.innerHTML = `<div class="no-data" style="padding:20px;text-align:center;color:#9ca3af;">${message}</div>`;
        }
        
        // Still resize even if skills failed to load
        setTimeout(() => autoResizeWindow(), 100);
    }
}

// Display skills from saved session data
function displaySkillsFromSavedData(uid, skillsData) {
    try {
        const skillsContainer = document.getElementById(`skills-${uid}`);
        if (!skillsContainer) return;
        
        // Convert skills object to array format
        const skillArray = Object.entries(skillsData).map(([name, data]) => ({
            name,
            ...data
        }));
        
        if (skillArray.length === 0) {
            skillsContainer.innerHTML = '<div class="no-data" style="padding:20px;text-align:center;color:#9ca3af;">No skill data available</div>';
            return;
        }
        
        // Sort by damage and take top 10
        const top10 = skillArray
            .sort((a, b) => (b.total || 0) - (a.total || 0))
            .slice(0, 10);
        
        // Render skills table
        renderSkillsTable(uid, top10);
        
        // Resize window after skills are loaded
        setTimeout(() => autoResizeWindow(), 100);
    } catch (error) {
        console.error('Error displaying saved skills:', error);
        const skillsContainer = document.getElementById(`skills-${uid}`);
        if (skillsContainer) {
            skillsContainer.innerHTML = '<div class="no-data" style="padding:20px;text-align:center;color:#9ca3af;">Error loading skill data</div>';
        }
    }
}

// Pause functionality
let isPaused = false;

async function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('btn-pause');
    const compactBtn = document.getElementById('btn-compact-pause');
    const icon = btn?.querySelector('i');
    const compactIcon = compactBtn?.querySelector('i');
    
    try {
        // Tell backend to pause/resume data collection
        await fetch(CONFIG.apiPause, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paused: isPaused })
        });
        
        if (isPaused) {
            stopAutoRefresh();
            if (icon) icon.className = 'fa-solid fa-play';
            if (compactIcon) compactIcon.className = 'fa-solid fa-play';
            if (btn) btn.title = 'Resume';
            if (compactBtn) compactBtn.title = 'Resume';
            showToast('⏸️ Paused - All data frozen', 'info', 5000);
        } else {
            startAutoRefresh();
            if (icon) icon.className = 'fa-solid fa-pause';
            if (compactIcon) compactIcon.className = 'fa-solid fa-pause';
            if (btn) btn.title = 'Pause';
            if (compactBtn) compactBtn.title = 'Pause';
            showToast('▶️ Resumed - Data collection active', 'success', 3000);
        }
    } catch (error) {
        console.error('Failed to toggle pause:', error);
        showToast('Failed to toggle pause', 'error');
        // Revert state on error
        isPaused = !isPaused;
    }
}

// Make functions globally available
window.renderPlayers = renderPlayers;
window.togglePlayerDetails = togglePlayerDetails;
window.exportPlayerData = exportPlayerData;
window.copyToClipboard = copyToClipboard;
window.copyPlayerToClipboard = copyPlayerToClipboard;
window.showNotification = showNotification;
window.togglePause = togglePause;
window.updateOpacitySlider = updateOpacitySlider;

// Opacity slider real-time update function
function updateOpacitySlider(value) {
    const percent = Math.round(value * 100);
    document.getElementById('opacity-value').textContent = percent + '%';
    
    // Apply immediately via IPC
    if (window.electronAPI?.setOpacity) {
        window.electronAPI.setOpacity(parseFloat(value));
    }
}

// ============================================================================
// V2.12.0 - NEW FEATURES
// ============================================================================

// Settings Modal Close Handler
document.getElementById('settings-close')?.addEventListener('click', () => {
    document.getElementById('modal-settings')?.classList.remove('active');
    
    // If we temporarily expanded for settings, restore compact size
    if (STATE.tempExpandedForSettings) {
        STATE.tempExpandedForSettings = false;
        setTimeout(() => autoResizeWindow(), 100);
    }
});

// Settings Tab Switching
function initializeSettingsTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = tab.dataset.tab;
            
            // Update tabs
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update panels
            document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
            document.querySelector(`[data-panel="${targetPanel}"]`).style.display = 'block';
            
            // Load user data path when About tab is opened
            if (targetPanel === 'about') {
                loadUserDataPath();
            }
        });
    });
}

// Load and display user data path
async function loadUserDataPath() {
    if (!window.electronAPI?.getUserDataPath) return;
    
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

// Open data folder in file explorer
function openDataFolder() {
    const pathElement = document.getElementById('user-data-path');
    const folderPath = pathElement?.dataset.path;
    
    if (folderPath && window.electronAPI?.openFolder) {
        window.electronAPI.openFolder(folderPath);
        showNotification('Opening data folder...', 'success');
    }
}

// Make functions global
window.openDataFolder = openDataFolder;

// Initialize tabs after DOM is ready
setTimeout(initializeSettingsTabs, 100);

// Function to attach column sort handlers (called after dynamic header updates)
function attachColumnSortHandlers() {
    document.querySelectorAll('.column-headers > div[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
        
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'desc';
        }
        
        // Update UI
        document.querySelectorAll('.column-headers > div').forEach(h => {
            h.classList.remove('sorted-asc', 'sorted-desc');
        });
        header.classList.add('active', currentSort.direction);
        
        // Re-render with new sort
        renderPlayers();
        
        showToast(`Sorted by ${header.textContent.trim()}`, 'info', 1500);
        });
    });
}

// Sortable Column Headers - Use setting for default
let currentSort = { column: SETTINGS.defaultSort || 'totalDmg', direction: 'desc' };

// Initial attachment of column sort handlers
attachColumnSortHandlers();

// Enhanced sortPlayers to use currentSort
const originalSortPlayers = sortPlayers;
function sortPlayers(players) {
    const getValueForSort = (p, col) => {
        switch (col) {
            case 'name': return (p.name || PLAYER_DB.get(p.uid) || `Unknown_${p.uid}`).toLowerCase();
            case 'dps': return p.total_dps || p.current_dps || 0;
            case 'maxDps': return p.max_dps || 0;
            case 'avgDps': return p.total_dps || 0;
            case 'totalDmg': return p.total_damage?.total || 0;
            case 'hps': return p.total_hps || 0;
            case 'dmgTaken': return p.taken_damage || 0;
            case 'gs': return p.fightPoint || 0;
            case 'rank': return 0; // Will be set by index
            default: return p.total_damage?.total || 0;
        }
    };
    
    const sorted = [...players].sort((a, b) => {
        // PRIORITY 1: Local player ALWAYS first (highest priority)
        const aIsLocal = a.isLocalPlayer || a.uid === STATE.localPlayerUid;
        const bIsLocal = b.isLocalPlayer || b.uid === STATE.localPlayerUid;
        
        if (aIsLocal && !bIsLocal) return -1;  // a is local, goes first
        if (!aIsLocal && bIsLocal) return 1;   // b is local, goes first
        
        // PRIORITY 2: Active players before idle players
        const aIsIdle = a.isIdle || false;
        const bIsIdle = b.isIdle || false;
        
        if (!aIsIdle && bIsIdle) return -1;  // a is active, goes first
        if (aIsIdle && !bIsIdle) return 1;   // b is active, goes first
        
        // PRIORITY 3: Sort by column (both active or both idle)
        const aVal = getValueForSort(a, currentSort.column);
        const bVal = getValueForSort(b, currentSort.column);
        
        if (currentSort.column === 'name') {
            return currentSort.direction === 'asc' 
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        
        return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    return sorted;
}

// Inline Export Buttons (replace modal)
document.getElementById('btn-copy')?.addEventListener('click', () => {
    copyToClipboard();
});

document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportAllCSV();
});

// Opacity slider
const opacitySlider = document.getElementById('setting-opacity');
const opacityValue = document.getElementById('opacity-value');

if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value);
        opacityValue.textContent = opacity + '%';
        document.querySelector('.meter-container').style.opacity = opacity / 100;
        
        // Save opacity preference
        SETTINGS.windowOpacity = opacity;
        SETTINGS.save();
    });
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

let savedSessions = [];

// Load saved sessions and populate dropdown
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();

        if (data.code === 0) {
            savedSessions = data.sessions || [];
            updateSessionDropdown();
        } else {
            console.error('Failed to load sessions:', data.msg);
            savedSessions = [];
            updateSessionDropdown();
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
        savedSessions = [];
        updateSessionDropdown();
    }
}

// Update session dropdown with loaded sessions
function updateSessionDropdown() {
    const dropdown = document.getElementById('session-select');
    if (!dropdown) return;

    // Save current selection
    const currentValue = dropdown.value;

    // Clear existing options
    dropdown.innerHTML = '';
    
    // Add "Current Session" with live stats
    const currentOption = document.createElement('option');
    currentOption.value = '';
    currentOption.id = 'current-session-option';
    currentOption.textContent = '⚡ Current Session (No data yet)'; // Initial text
    dropdown.appendChild(currentOption); // Append to DOM FIRST
    updateCurrentSessionText(); // THEN update the text with live stats

    // Filter sessions by current character (if we know the character)
    let filteredSessions = savedSessions;
    if (STATE.localPlayerUid) {
        filteredSessions = savedSessions.filter(s => 
            !s.characterUid || s.characterUid === STATE.localPlayerUid
        );
    }

    // Sort all sessions by timestamp (MOST RECENT FIRST - mixed manual and auto)
    const sortedSessions = [...filteredSessions].sort((a, b) => b.timestamp - a.timestamp);
    
    // Add ALL sessions sorted by most recent (no separation)
    sortedSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        const date = new Date(session.timestamp).toLocaleString('en-US', { 
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
        });
        const icon = session.autoSaved ? '🤖' : '📝';
        const duration = formatDuration(session.duration || 0);
        // Consistent format: icon + name + duration + timestamp
        option.textContent = `${icon} ${session.name} - ${duration} - ${date}`;
        dropdown.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
        dropdown.value = currentValue;
    }
    
    // Update session count display
    updateSessionCount();
}

// Update "Current Session" text with live stats
function updateCurrentSessionText() {
    const option = document.getElementById('current-session-option');
    if (!option) return;
    
    // Calculate live stats from current players
    const players = Array.from(STATE.players.values());
    const activeCount = players.filter(p => (p.total_damage?.total || 0) > 0 || (p.total_healing?.total || 0) > 0).length;
    const totalDPS = players.reduce((sum, p) => sum + (p.total_dps || 0), 0);
    const duration = STATE.startTime ? Date.now() - STATE.startTime : 0;
    const durationStr = formatDuration(duration);
    
    if (activeCount > 0) {
        option.textContent = `⚡ Current Session - ${activeCount}p - ${formatNumber(totalDPS)} DPS - ${durationStr}`;
    } else {
        option.textContent = '⚡ Current Session (No data yet)';
    }
}

// Update session count and add manage button
function updateSessionCount() {
    const container = document.querySelector('.session-selector');
    if (!container) return;
    
    let countDisplay = document.getElementById('session-count-display');
    if (!countDisplay) {
        countDisplay = document.createElement('div');
        countDisplay.id = 'session-count-display';
        countDisplay.style.cssText = 'font-size: 10px; color: var(--text-secondary); margin-top: 4px;';
        container.appendChild(countDisplay);
    }
    
    const manual = savedSessions.filter(s => !s.autoSaved).length;
    const auto = savedSessions.filter(s => s.autoSaved).length;
    countDisplay.textContent = `${manual} manual, ${auto} auto-saved sessions`;
    
    // Add manage sessions button if not exists
    if (!document.getElementById('btn-manage-sessions')) {
        const manageBtn = document.createElement('button');
        manageBtn.id = 'btn-manage-sessions';
        manageBtn.className = 'btn-secondary';
        manageBtn.style.cssText = 'font-size: 10px; padding: 4px 8px; margin-top: 4px;';
        manageBtn.innerHTML = '<i class="fa-solid fa-cog"></i> Manage Sessions';
        manageBtn.onclick = () => {
            // Use popup window if available (better UX)
            if (window.electronAPI?.openSessionManagerWindow) {
                window.electronAPI.openSessionManagerWindow();
            } else {
                openSessionManager(); // Fallback for non-Electron
            }
        };
        container.appendChild(manageBtn);
    }
}

// Show manage sessions modal with delete options
function showManageSessionsModal() {
    if (savedSessions.length === 0) {
        showToast('No saved sessions to manage', 'info');
        return;
    }
    
    const sortedSessions = [...savedSessions].sort((a, b) => b.timestamp - a.timestamp);
    
    const modalHTML = `
        <div id="manage-sessions-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
             background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; 
             box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 999999; width: 750px; max-width: 95vw; max-height: 75vh; overflow-y: auto; pointer-events: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 15px; color: var(--accent-gold);">Manage Saved Sessions</h3>
                <button onclick="closeManageSessionsModal()" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">
                ${savedSessions.length} total sessions (${savedSessions.filter(s => !s.autoSaved).length} manual, ${savedSessions.filter(s => s.autoSaved).length} auto-saved)
            </div>
            <div id="sessions-list" style="display: flex; flex-direction: column; gap: 8px;">
                ${sortedSessions.map(session => `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-darker); border-radius: 4px; border-left: 3px solid ${session.autoSaved ? 'var(--accent-tank)' : 'var(--accent-gold)'};">
                        <div style="flex: 1; font-size: 12px;">
                            <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 4px;">
                                ${session.autoSaved ? '🤖' : '📝'} ${session.name}
                            </div>
                            <div style="color: var(--text-secondary); font-size: 10px;">
                                ${session.playerCount} players • ${formatNumber(session.totalDps)} DPS • ${new Date(session.timestamp).toLocaleString()}
                            </div>
                        </div>
                        <button onclick="deleteSession(${session.id})" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); 
                                border-radius: 4px; color: #ef4444; font-size: 11px; cursor: pointer; white-space: nowrap;">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
                <button onclick="closeManageSessionsModal()" style="padding: 8px 16px; background: var(--bg-darker); border: 1px solid var(--border); 
                        border-radius: 4px; color: var(--text-secondary); font-size: 12px; cursor: pointer;">Close</button>
            </div>
        </div>
        <div id="manage-sessions-backdrop" onclick="closeManageSessionsModal()" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
             background: rgba(0,0,0,0.7); z-index: 999998; backdrop-filter: blur(2px); pointer-events: auto;"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close manage sessions modal
window.closeManageSessionsModal = function() {
    document.getElementById('manage-sessions-modal')?.remove();
    document.getElementById('manage-sessions-backdrop')?.remove();
};

// Delete a session
window.deleteSession = async function(sessionId) {
    if (!confirm('Delete this session? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.code === 0) {
            showToast('Session deleted successfully', 'success');
            await loadSessions(); // Refresh list
            
            // Update the modal content
            closeManageSessionsModal();
            if (savedSessions.length > 0) {
                showManageSessionsModal();
            }
        } else {
            showToast(`Failed to delete session: ${data.msg}`, 'error');
        }
    } catch (error) {
        console.error('Failed to delete session:', error);
        showToast('Failed to delete session', 'error');
    }
};

// Generate a meaningful session name based on battle data
function generateSessionName(playerCount, duration) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Classify by player count
    let groupType = '';
    if (playerCount === 1) {
        groupType = 'Solo';
    } else if (playerCount <= 4) {
        groupType = `${playerCount}P Party`;
    } else if (playerCount <= 8) {
        groupType = `${playerCount}P Raid`;
    } else {
        groupType = `${playerCount}P Battle`;
    }
    
    // Classify by duration
    let durationStr = '';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    if (minutes === 0) {
        durationStr = `${seconds}s`;
    } else if (minutes < 5) {
        durationStr = `${minutes}m${seconds}s`;
    } else {
        durationStr = `${minutes}min`;
    }
    
    // Format: "8P Raid - 12min [14:30]"
    return `${groupType} - ${durationStr} [${timeStr}]`;
}

// Auto-save session silently (for zone changes)
async function autoSaveSession(sessionName) {
    if (STATE.players.size === 0) return;
    
    try {
        const duration = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
        const playerCount = STATE.players.size;
        
        // Generate meaningful name if default name is provided
        if (!sessionName || sessionName.includes('Previous Battle')) {
            sessionName = generateSessionName(playerCount, duration);
        }
        
        // Fetch skill data for all players
        const playerArray = await Promise.all(
            Array.from(STATE.players.values()).map(async (p) => {
                let skills = {};
                try {
                    const skillRes = await fetch(`${CONFIG.apiSkill}/${p.uid}`);
                    if (skillRes.ok) {
                        const skillData = await skillRes.json();
                        if (skillData && skillData.code === 0) {
                            skills = skillData.data?.skills || skillData.skills || {};
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch skills for UID ${p.uid}:`, error);
                }
                
                return {
                    uid: p.uid,
                    name: p.name || PLAYER_DB.get(p.uid) || 'Unknown',
                    profession: p.profession || 'unknown',
                    total_damage: p.total_damage || { total: 0 },
                    total_healing: p.total_healing || { total: 0 },
                    total_dps: p.total_dps || 0,
                    total_hps: p.total_hps || 0,
                    max_dps: p.max_dps || 0,
                    taken_damage: p.taken_damage || 0,
                    critRate: p.critRate || 0,
                    luckyRate: p.luckyRate || 0,
                    maxDamage: p.maxDamage || 0,
                    g_score: p.g_score || p.gs || 0,
                    isLocalPlayer: p.isLocalPlayer || p.uid === STATE.localPlayerUid,
                    skills: skills // Include skills in save
                };
            })
        );
        
        const localPlayer = Array.from(STATE.players.values()).find(p => p.uid === STATE.localPlayerUid);
        const characterName = localPlayer?.name || PLAYER_DB.get(STATE.localPlayerUid) || 'Unknown';
        
        const response = await fetch('/api/sessions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: sessionName,
                timestamp: Date.now(),
                duration: duration,
                players: playerArray,
                characterName: characterName,
                localPlayerUid: STATE.localPlayerUid
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to auto-save session');
        }
        
        await response.json();
        console.log(`✅ Auto-saved session: ${sessionName}`);
        showToast(`Previous battle auto-saved (${formatTime(duration)})`, 'success', 2000);
        loadSessions(); // Refresh sessions list
    } catch (error) {
        console.error('Error auto-saving session:', error);
    }
}

// Save current session
async function saveCurrentSession() {
    if (STATE.players.size === 0) {
        showToast('No data to save', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;
    
    const defaultName = `Session ${new Date().toLocaleString()}`;
    
    modal.innerHTML = `
        <div id="save-session-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
             background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 16px 20px; 
             box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; min-width: 320px; max-width: 400px;">
            <div style="margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--text-primary);">Save Session</div>
            <input type="text" id="session-name-input" value="${defaultName}" 
                   style="width: 100%; padding: 6px 10px; background: var(--bg-darker); border: 1px solid var(--border); 
                   border-radius: 4px; color: var(--text-primary); font-size: 12px; margin-bottom: 12px; box-sizing: border-box;">
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button id="cancel-save" style="padding: 6px 14px; background: var(--bg-darker); border: 1px solid var(--border); 
                        border-radius: 4px; color: var(--text-secondary); font-size: 12px; cursor: pointer;">Cancel</button>
                <button id="confirm-save" style="padding: 6px 14px; background: var(--accent-gold); border: none; 
                        border-radius: 4px; color: var(--bg-dark); font-size: 12px; font-weight: 600; cursor: pointer;">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('session-name-input');
    input.focus();
    input.select();
    
    const cleanup = () => {
        document.body.removeChild(modal);
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cleanup();
    });
    
    document.getElementById('cancel-save').addEventListener('click', cleanup);
    
    const saveAction = async () => {
        const sessionName = input.value.trim();
        if (!sessionName) {
            showToast('Session name cannot be empty', 'error');
            return;
        }
        
        cleanup();
        
        try {
            const duration = STATE.startTime ? Math.floor((Date.now() - STATE.startTime) / 1000) : 0;
            
            const playerArray = Array.from(STATE.players.values()).map(p => ({
                uid: p.uid,
                name: p.name || PLAYER_DB.get(p.uid) || 'Unknown',
                profession: p.profession || 'unknown',
                total_damage: p.total_damage || { total: 0 },
                total_healing: p.total_healing || { total: 0 },
                total_dps: p.total_dps || 0,
                total_hps: p.total_hps || 0,
                max_dps: p.max_dps || 0,
                taken_damage: p.taken_damage || 0,
                critRate: p.critRate || 0,
                luckyRate: p.luckyRate || 0,
                maxDamage: p.maxDamage || 0,
                g_score: p.g_score || p.gs || 0,
                isLocalPlayer: p.isLocalPlayer || p.uid === STATE.localPlayerUid
            }));
            
            const localPlayer = Array.from(STATE.players.values()).find(p => p.uid === STATE.localPlayerUid);
            const characterName = localPlayer?.name || PLAYER_DB.get(STATE.localPlayerUid) || 'Unknown';
            
            const response = await fetch('/api/sessions/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: sessionName,
                    timestamp: Date.now(),
                    duration: duration,
                    players: playerArray,
                    characterName: characterName,
                    localPlayerUid: STATE.localPlayerUid
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to save session');
            }
            
            const result = await response.json();
            showToast(`Session saved: ${sessionName}`, 'success');
            loadSessions(); // Refresh sessions list
        } catch (error) {
            console.error('Error saving session:', error);
            showToast('Failed to save session', 'error');
        }
    };
    
    document.getElementById('confirm-save').addEventListener('click', saveAction);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveAction();
        if (e.key === 'Escape') cleanup();
    });
}

// Load selected session
async function loadSelectedSession(sessionId) {
    if (!sessionId) {
        // Switching back to live mode - CRITICAL: Clear ALL session data
        STATE.players.clear();
        STATE.startTime = null;
        STATE.inCombat = false;
        expandedPlayerIds = []; // Clear expanded players from session view
        skillsCache.clear(); // Clear skill cache from session
        
        showToast('📡 Resuming live data...', 'info', 2000);
        
        // Force immediate refresh to get live data
        await fetchPlayerData();
        renderPlayers();
        
        // Resume auto-refresh
        if (!isPaused) {
            startAutoRefresh();
        }
        return;
    }

    try {
        // Stop auto-refresh to prevent live data from overwriting session
        stopAutoRefresh();
        
        const response = await fetch(`/api/sessions/${sessionId}`);
        const data = await response.json();
        
        if (data.code === 0) {
            const session = data.session;
            
            // Load session data into STATE (don't clear backend)
            STATE.players.clear();
            session.players.forEach(player => {
                STATE.players.set(player.uid, player);
            });
            
            // Update UI
            renderPlayers(); // renderPlayers() calls updateStatusBar() internally
            
            // Show success message with instructions
            showToast(`📂 Viewing: ${session.name} (Select "Current Session" to return to live)`, 'info', 5000);
            
        } else {
            showToast('Failed to load session', 'error');
            // Resume auto-refresh on error
            if (!isPaused) {
                startAutoRefresh();
            }
        }
    } catch (error) {
        console.error('Failed to load session:', error);
        showToast('Failed to load session', 'error');
        // Resume auto-refresh on error
        if (!isPaused) {
            startAutoRefresh();
        }
    }
}

// Clear current data (for loading sessions)
async function clearData() {
    try {
        const response = await fetch('/api/clear', { method: 'POST' });
        const data = await response.json();
        if (data.code === 0) {
            STATE.players.clear();
            renderPlayers(); // renderPlayers() calls updateStatusBar() internally
        }
    } catch (error) {
        console.error('Failed to clear data:', error);
    }
}

// Initialize session management
function initializeSessionManagement() {
    // Load sessions on startup
    loadSessions();
    
    // Save session button
    const saveBtn = document.getElementById('btn-save-session');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentSession);
    }
    
    // Session selector
    const dropdown = document.getElementById('session-select');
    if (dropdown) {
        dropdown.addEventListener('change', (e) => {
            loadSelectedSession(e.target.value);
        });
    }
}

// ============================================================================
// EMERGENCY UNSTICK HOTKEY
// ============================================================================

// Add global keyboard shortcut for force unlock (Ctrl+U)
document.addEventListener('keydown', (e) => {
    // Ctrl+U or Cmd+U - Force unlock window if stuck
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        if (window.electronAPI?.forceUnlockWindow) {
            window.electronAPI.forceUnlockWindow();
            showNotification('🔓 Window force unlocked!', 'success');
            console.log('🚨 User triggered force unlock (Ctrl+U)');
        }
    }
});

// CRITICAL: Detect popup mode from query parameters before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOM is already loaded
    initialize();
}
