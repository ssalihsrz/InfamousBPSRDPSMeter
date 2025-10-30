// ============================================================================
// MAPPING MANAGER
// Handles boss/mob/map mappings with GitHub sync for crowdsourced data
// ============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

class MappingManager {
    constructor(userDataPath, logger) {
        this.userDataPath = userDataPath;
        this.logger = logger;
        
        // File paths
        this.localMappingFile = path.join(userDataPath, 'boss-mappings.json');
        this.unknownIdsFile = path.join(userDataPath, 'unknown-ids.json');
        
        // GitHub raw URL for mappings
        this.githubMappingUrl = 'https://raw.githubusercontent.com/ssalihsrz/InfamousBPSRDPSMeter/main/src/data/boss-mappings.json';
        
        // In-memory cache
        this.bossMeterIds = {};
        this.bossData = {};
        this.maps = {};
        this.unknownIds = new Set();
        
        // BIDIRECTIONAL mapping: boss name → array of IDs
        // Allows finding all IDs for a boss (multiple IDs can map to same boss)
        this.bossNameToIds = {};
        
        // Local fallback (bundled with app)
        this.fallbackMappingFile = path.join(__dirname, 'data', 'boss-mappings.json');
    }
    
    /**
     * Initialize: Load mappings from GitHub (with local fallback)
     */
    async initialize() {
        this.logger('[Mappings] 🗺️ Initializing mapping system...');
        
        try {
            // Try to update from GitHub first
            await this.updateFromGitHub();
        } catch (err) {
            this.logger(`[Mappings] ⚠️ GitHub update failed: ${err.message}`);
            this.logger('[Mappings] 📂 Using local mappings...');
        }
        
        // Load mappings (either just downloaded or from cache)
        await this.loadMappings();
        
        // Load unknown IDs log
        this.loadUnknownIds();
        
        const bossCount = Object.keys(this.bossMeterIds).length;
        const uniqueBosses = Object.keys(this.bossData).length;
        const mapCount = Object.keys(this.maps).length;
        
        this.logger(`[Mappings] ✅ Loaded ${bossCount} boss IDs, ${uniqueBosses} unique bosses, ${mapCount} maps`);
        
        // Schedule periodic updates (every 24 hours)
        this.schedulePeriodicUpdate();
    }
    
    /**
     * Download latest mappings from GitHub
     */
    async updateFromGitHub() {
        return new Promise((resolve, reject) => {
            this.logger('[Mappings] 🔄 Checking for mapping updates from GitHub...');
            
            const request = https.get(this.githubMappingUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        // Validate JSON
                        const mappings = JSON.parse(data);
                        
                        // Save to local file
                        fs.writeFileSync(this.localMappingFile, data, 'utf8');
                        
                        this.logger('[Mappings] ✅ Mappings updated from GitHub');
                        resolve();
                    } catch (err) {
                        reject(new Error(`JSON parse error: ${err.message}`));
                    }
                });
            });
            
            request.on('error', (err) => {
                reject(err);
            });
            
            // Timeout after 10 seconds
            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    /**
     * Load mappings from file (local cache or fallback)
     */
    async loadMappings() {
        let mappingFile = this.localMappingFile;
        
        // Check if local cache exists
        if (!fs.existsSync(mappingFile)) {
            this.logger('[Mappings] 📦 No local cache, using bundled mappings');
            mappingFile = this.fallbackMappingFile;
        }
        
        try {
            const data = fs.readFileSync(mappingFile, 'utf8');
            const mappings = JSON.parse(data);
            
            this.bossMeterIds = mappings.bossMeterIds || {};
            this.bossData = mappings.bossData || {};
            this.maps = mappings.maps || {};
            
            // Build reverse index: boss name → array of IDs
            this.buildReverseIndex();
            
            this.logger(`[Mappings] 📖 Loaded from: ${mappingFile}`);
        } catch (err) {
            this.logger(`[Mappings] ❌ Failed to load mappings: ${err.message}`);
            // Empty mappings on error
            this.bossMeterIds = {};
            this.bossData = {};
            this.maps = {};
        }
    }
    
    /**
     * Build reverse index: boss name → array of IDs
     * Allows finding all IDs for a boss (one boss can have multiple IDs)
     */
    buildReverseIndex() {
        this.bossNameToIds = {};
        
        for (const [id, bossName] of Object.entries(this.bossMeterIds)) {
            if (!this.bossNameToIds[bossName]) {
                this.bossNameToIds[bossName] = [];
            }
            this.bossNameToIds[bossName].push(id);
        }
        
        // Log bosses with multiple IDs
        const multiBosses = Object.entries(this.bossNameToIds)
            .filter(([name, ids]) => ids.length > 1);
        
        if (multiBosses.length > 0) {
            this.logger(`[Mappings] 🔄 Found ${multiBosses.length} bosses with multiple IDs:`);
            multiBosses.forEach(([name, ids]) => {
                this.logger(`[Mappings]    ${name}: ${ids.length} IDs (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''})`);
            });
        }
    }
    
    /**
     * Look up boss/mob name by ID
     */
    getBossName(id) {
        const idStr = String(id);
        return this.bossMeterIds[idStr] || null;
    }
    
    /**
     * Smart discovery: Try to match enemy name to known boss and learn new ID
     * @param {string} enemyId - The enemy ID we don't recognize
     * @param {string} enemyName - The enemy name from packet
     * @returns {string|null} - Matched boss name if found
     */
    smartDiscovery(enemyId, enemyName) {
        if (!enemyName || enemyName === '') return null;
        
        const idStr = String(enemyId);
        
        // Already known?
        if (this.bossMeterIds[idStr]) return this.bossMeterIds[idStr];
        
        // Try fuzzy match to known boss names
        const normalizedName = enemyName.toLowerCase().trim();
        
        for (const bossName of Object.keys(this.bossData)) {
            const normalizedBoss = bossName.toLowerCase();
            
            // Exact match
            if (normalizedName === normalizedBoss) {
                this.logger(`[Mappings] 🎯 DISCOVERED: ID ${idStr} → ${bossName} (exact match)`);
                this.learnNewId(idStr, bossName);
                return bossName;
            }
            
            // Contains match (enemy name contains boss name or vice versa)
            if (normalizedName.includes(normalizedBoss) || normalizedBoss.includes(normalizedName)) {
                this.logger(`[Mappings] 🎯 DISCOVERED: ID ${idStr} → ${bossName} (fuzzy match)`);
                this.learnNewId(idStr, bossName);
                return bossName;
            }
        }
        
        // No match found - log as unknown with context
        this.logUnknownId(idStr, { enemyName, timestamp: new Date().toISOString() });
        
        return null;
    }
    
    /**
     * Learn a new ID for an existing boss (adds to in-memory mapping)
     * @param {string} id - The new ID discovered
     * @param {string} bossName - The boss name it maps to
     */
    learnNewId(id, bossName) {
        // Add to forward mapping
        this.bossMeterIds[id] = bossName;
        
        // Add to reverse mapping
        if (!this.bossNameToIds[bossName]) {
            this.bossNameToIds[bossName] = [];
        }
        if (!this.bossNameToIds[bossName].includes(id)) {
            this.bossNameToIds[bossName].push(id);
        }
        
        // Remove from unknown IDs
        this.unknownIds.delete(id);
        
        // Save to local mapping file for persistence
        this.saveMappings();
    }
    
    /**
     * Save current mappings to local file (persists learned IDs)
     */
    saveMappings() {
        try {
            const mappings = {
                bossMeterIds: this.bossMeterIds,
                bossData: this.bossData,
                maps: this.maps
            };
            
            fs.writeFileSync(this.localMappingFile, JSON.stringify(mappings, null, 2), 'utf8');
            this.logger(`[Mappings] 💾 Saved updated mappings (${Object.keys(this.bossMeterIds).length} IDs)`);
        } catch (err) {
            this.logger(`[Mappings] ❌ Failed to save mappings: ${err.message}`);
        }
    }
    
    /**
     * Get all known IDs for a boss name
     * @param {string} bossName - The boss name
     * @returns {string[]} - Array of IDs that map to this boss
     */
    getIdsForBoss(bossName) {
        return this.bossNameToIds[bossName] || [];
    }
    
    /**
     * Get boss data (respawn time, map, type)
     */
    getBossData(name) {
        return this.bossData[name] || null;
    }
    
    /**
     * Get map data
     */
    getMapData(name) {
        return this.maps[name] || null;
    }
    
    /**
     * Check if ID is known
     */
    isKnownId(id) {
        return this.getBossName(id) !== null;
    }
    
    /**
     * Log unknown ID for later contribution
     */
    logUnknownId(id, context = {}) {
        const idStr = String(id);
        
        // Skip if already known or already logged
        if (this.isKnownId(idStr) || this.unknownIds.has(idStr)) {
            return;
        }
        
        this.unknownIds.add(idStr);
        
        // Log to file for user contribution
        const unknownEntry = {
            id: idStr,
            firstSeen: new Date().toISOString(),
            context: context
        };
        
        this.saveUnknownId(unknownEntry);
        
        this.logger(`[Mappings] 🔍 Unknown ID detected: ${idStr} (context: ${JSON.stringify(context)})`);
    }
    
    /**
     * Load unknown IDs from log file
     */
    loadUnknownIds() {
        try {
            if (fs.existsSync(this.unknownIdsFile)) {
                const data = fs.readFileSync(this.unknownIdsFile, 'utf8');
                const entries = JSON.parse(data);
                
                entries.forEach(entry => {
                    this.unknownIds.add(entry.id);
                });
                
                this.logger(`[Mappings] 📋 Loaded ${this.unknownIds.size} unknown IDs from log`);
            }
        } catch (err) {
            this.logger(`[Mappings] ⚠️ Failed to load unknown IDs: ${err.message}`);
        }
    }
    
    /**
     * Save unknown ID to log file
     */
    saveUnknownId(entry) {
        try {
            let entries = [];
            
            // Load existing entries
            if (fs.existsSync(this.unknownIdsFile)) {
                const data = fs.readFileSync(this.unknownIdsFile, 'utf8');
                entries = JSON.parse(data);
            }
            
            // Add new entry
            entries.push(entry);
            
            // Keep only last 1000 entries
            if (entries.length > 1000) {
                entries = entries.slice(-1000);
            }
            
            // Save back
            fs.writeFileSync(this.unknownIdsFile, JSON.stringify(entries, null, 2), 'utf8');
        } catch (err) {
            this.logger(`[Mappings] ❌ Failed to save unknown ID: ${err.message}`);
        }
    }
    
    /**
     * Get unknown IDs for contribution
     */
    getUnknownIds() {
        try {
            if (fs.existsSync(this.unknownIdsFile)) {
                const data = fs.readFileSync(this.unknownIdsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (err) {
            this.logger(`[Mappings] ❌ Failed to read unknown IDs: ${err.message}`);
        }
        return [];
    }
    
    /**
     * Clear unknown IDs log (after contribution)
     */
    clearUnknownIds() {
        try {
            if (fs.existsSync(this.unknownIdsFile)) {
                fs.unlinkSync(this.unknownIdsFile);
            }
            this.unknownIds.clear();
            this.logger('[Mappings] ✅ Unknown IDs log cleared');
        } catch (err) {
            this.logger(`[Mappings] ❌ Failed to clear unknown IDs: ${err.message}`);
        }
    }
    
    /**
     * Schedule periodic update check (every 24 hours)
     */
    schedulePeriodicUpdate() {
        const updateInterval = 24 * 60 * 60 * 1000; // 24 hours
        
        setInterval(async () => {
            this.logger('[Mappings] 🔄 Periodic update check...');
            try {
                await this.updateFromGitHub();
                await this.loadMappings();
                this.logger('[Mappings] ✅ Periodic update completed');
            } catch (err) {
                this.logger(`[Mappings] ⚠️ Periodic update failed: ${err.message}`);
            }
        }, updateInterval);
        
        this.logger('[Mappings] ⏰ Scheduled periodic updates (every 24h)');
    }
    
    /**
     * Get stats for display
     */
    getStats() {
        return {
            totalIds: Object.keys(this.bossMeterIds).length,
            uniqueBosses: Object.keys(this.bossData).length,
            maps: Object.keys(this.maps).length,
            unknownIds: this.unknownIds.size
        };
    }
}

module.exports = MappingManager;
