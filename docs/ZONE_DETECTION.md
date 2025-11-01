# Zone Detection System

## Overview
Blue Protocol zones are identified by server port numbers. The meter automatically detects zone changes and classifies zones by type.

## Zone Type Classification

### Pattern-Based Detection
Zone types are determined by ID ranges:

```javascript
1000-1999 → Town (safe zones, cities)
2000-2999 → Field (open world areas)
3000-3999 → Raid (raid instances)
4000-4999 → Dungeon (dungeon instances)
5000-5999 → PvP (arena/battleground zones)
```

## Current Known Zones

### Towns (1xxx)
- `1001` - Asterleeds
- `1002` - Training Grounds
- `1100` - Central City

### Fields (2xxx)
- `2001` - Plateau of Beginnings
- `2002` - Everlasting Summer Beach
- `2003` - Underground City Remnants

### Raids (3xxx)
- `3001` - Thunder Wyvern
- `3002` - Ancient Dragon

### Dungeons (4xxx)
- `4001` - Abandoned Mine (Normal)
- `4002` - Abandoned Mine (Hard)
- `4003` - Ancient Temple (Normal)
- `4004` - Ancient Temple (Hard)
- `4005` - Demon's Nest (Normal)
- `4006` - Demon's Nest (Hard)

### PvP (5xxx)
- `5001` - Arena
- `5002` - PvP Battle Zone

## Unknown Zone Logging

### How It Works
When you enter a zone not in our mapping:
1. **Automatic Detection** - Zone ID captured from server port
2. **Type Classification** - Determined by ID range pattern
3. **Packet Capture** - First 200 chars of raw packet data saved
4. **File Storage** - Saved to `unknown_zones.json`

### Log Output Example
```
🗺️ UNKNOWN ZONE DETECTED: ID=2005, Type=field, Time=2025-11-01T13:30:00.000Z
📦 Packet Data (first 200 chars): 0000007800060000127c00000...
💾 Saved 1 unknown zones to: C:\Users\...\unknown_zones.json
```

### Unknown Zones File Format
```json
{
  "comment": "Unknown zones detected during gameplay - help us complete the mapping!",
  "generatedAt": "2025-11-01T13:30:00.000Z",
  "count": 1,
  "zones": {
    "2005": {
      "id": 2005,
      "type": "field",
      "firstSeen": "2025-11-01T13:30:00.000Z",
      "rawData": "0000007800060000127c00000..."
    }
  }
}
```

## Helping Complete the Mapping

### What You Can Do
1. **Play the game normally** - Just enter different zones
2. **Check logs** - Look for "UNKNOWN ZONE DETECTED" messages
3. **Share the file** - Send `unknown_zones.json` to the dev team
4. **Note the zone name** - Tell us what the zone is actually called in-game

### Where to Share
- GitHub Issues: Create an issue with your `unknown_zones.json`
- Discord: Share in the support channel
- Pull Request: Submit updated `tables/zone_names.json`

## Technical Details

### Zone Detection Code
Located in: `src/server/sniffer.js`

**Key Functions:**
- `getZoneType(zoneId)` - Classifies zone by ID pattern
- `getZoneName(zoneId)` - Returns mapped name or descriptive fallback
- `logUnknownZone(zoneId, rawData)` - Logs unknown zones
- `saveUnknownZones()` - Saves to file

### Zone Change Detection
```javascript
// Server port = Zone ID
const destPort = serverAddress.split(':')[1];
const zoneId = parseInt(destPort);

// Classify and name
const zoneType = getZoneType(zoneId);
const zoneName = getZoneName(zoneId);

// Log if unknown
logUnknownZone(zoneId, rawPacketData);
```

### Packet Data Captured
When zone change occurs:
- TCP reassembled packet buffer
- Hex-encoded (first 200 characters)
- Contains Blue Protocol protobuf data
- May include zone metadata

## Future Features

### Zone-Specific Behaviors (Planned)
- **Towns**: Reduce packet processing (no combat)
- **Dungeons**: Enable auto-save on completion
- **Raids**: Track boss phases
- **Fields**: Track world boss spawns
- **PvP**: Show kill/death ratios

### Enhanced Session Naming
Current:
```
"11/01 9:15 AM - Battle - 5m30s (8p)"
```

Future with zone data:
```
"11/01 9:15 AM - Ancient Temple (Hard) - 5m30s (8p)"
"11/01 10:30 AM - Thunder Wyvern Raid - 12m15s (20p)"
```

## Community Resources

### Blue Protocol Zone Maps
- [Star Resonance Interactive Map](https://star-resonance.com/map/)
- [Star Resonance THGL Map](https://starresonance.th.gl/)
- [GameMaps.gg Blue Protocol](https://gamemaps.gg/game/blue-protocol)

### Technical References
- [BPSR Logs (Rust DPS Meter)](https://github.com/winjwinj/bpsr-logs)
- [Blue Protocol Packet Analysis](/docs/PACKET_ANALYSIS.md)

## FAQ

### Q: Why are some zones showing as "Field 2005" instead of a name?
**A:** That zone hasn't been mapped yet. It will be logged to `unknown_zones.json` for future mapping.

### Q: Will unknown zones affect functionality?
**A:** No! The meter works perfectly. Zone detection is just for better naming and future features.

### Q: How accurate is the zone type classification?
**A:** Very accurate! Based on consistent ID patterns used by Blue Protocol servers.

### Q: Can I add zones manually?
**A:** Yes! Edit `tables/zone_names.json` and submit a pull request.

### Q: What if I enter a zone with ID outside known ranges?
**A:** It will be classified as "unknown" type and logged for investigation.

## Contributing

Help us build the complete zone mapping!

1. Play the game and explore all zones
2. Check `unknown_zones.json` after playing
3. Match zone IDs with in-game zone names
4. Submit findings via GitHub or Discord

Every zone you visit helps improve the meter for everyone! 🗺️
