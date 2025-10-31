# ⚔️ Infamous BPSR DPS Meter v3.1.192

**The Ultimate Blue Protocol Combat Tracker** - Real-time DPS/HPS analysis with modern UI

[\![License](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)
[\![Version](https://img.shields.io/badge/Version-3.1.192-green)](https://github.com/ssalihsrz/InfamousBPSRDPSMeter)
[\![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-blue)](#installation)
[\![Downloads](https://img.shields.io/github/downloads/ssalihsrz/InfamousBPSRDPSMeter/total)](https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases)

> **🌟 Original Project:** [StarResonanceDamageCounter](https://github.com/dmlgzs/StarResonanceDamageCounter) by dmlgzs  
> **🔱 Forked From:** [NeRooNx/BPSR-Meter](https://github.com/NeRooNx/BPSR-Meter)  
> **📊 BPSR Logs:** [winjwinj/bpsr-logs](https://github.com/winjwinj/bpsr-logs)
> 
> This enhanced edition builds upon excellent work from the Blue Protocol community with improved stability, performance, session management, and healer support.

---

## 📋 Latest Release: v3.1.192

### 🐛 Critical Fixes
- **Retrofit Not Working** - Now properly updates ALL old session name formats to current standard
- **Empty Sessions Saved** - Validates combat data before saving (local player or top 5 must have DPS/HPS)

[📥 Download v3.1.192](https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases/latest)

---

## ⚡ Key Features

### 📊 **Combat Tracking**
- **Real-Time DPS/HPS** - Live damage and healing per second tracking
- **Top 30 Players** - Automatic player prioritization by performance
- **Skill Breakdown** - Detailed skill usage, crit rate, lucky rate for all players
- **Session Management** - Auto-save combat sessions with dropdown navigation
- **Zone Detection** - Automatic boss/dungeon name detection

### 💊 **Healer Support**
- **Healer Mode** - Toggle between DPS and HPS display
- **Overheal Tracking** - Effective healing vs overheal calculations
- **Healing Efficiency** - Real-time efficiency percentage
- **Deaths Prevented** - Counter for clutch heals (<30% HP saves)

### 🎨 **UI & Display**
- **Compact Mode** - Minimal overlay for maximum gameplay visibility
- **Full Mode** - Detailed statistics and expanded columns
- **Draggable Window** - Position anywhere on screen
- **Customizable Columns** - Show/hide columns per mode
- **Separate Scaling** - Independent zoom for compact/full modes
- **Always on Top** - Optional window priority

### 💾 **Data Persistence**
- **Player Name Cache** - Remembers player names across sessions
- **Auto-Save Sessions** - Configurable limit (10-100, default 20)
- **Manual Sessions** - Unlimited manual saves
- **Settings Backup** - Survives uninstall/reinstall in AppData
- **Session Export** - Copy stats to clipboard

### ⚙️ **Settings & Control**
- **Auto-Clear on Zone** - Optional meter reset on zone/dungeon change
- **Keep After Dungeon** - Delay clear until first damage in new zone
- **Auto-Update** - Automatic update notifications from GitHub
- **Opacity Control** - Adjustable window transparency
- **Performance Modes** - Optimized rendering options

---

## 📋 Recent Releases

### v3.1.191 - Skills, Sorting & Dragging
- **Skills Data Missing** - Auto-saved sessions now include full skill breakdown
- **Session Sorting** - Standardized filename format for consistent sorting
- **Window Dragging** - Simplified CSS hierarchy for reliable dragging

### v3.1.190 - Startup Crash Hotfix
- **App Crashes on Startup** - Fixed Socket.IO initialization order

### v3.1.189 - Session Dropdown Refresh
- **Real-Time Session Updates** - Dropdown refreshes immediately after auto-save
- **Skills Preservation** - Skills data never cleared mid-session

---

## 🚀 Quick Start

### 📥 Download & Install

**Step 1: Download the Latest Release**
- 🔗 **[Download Installer](https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases/latest)** ← Click here\!
- Get: \`InfamousBPSRDPSMeter-Setup-3.1.192.exe\` (~90MB)
- 🆕 **Auto-Update:** Automatic update notifications from GitHub\!

**Step 2: Install Npcap (Required)**
- Download from: https://npcap.com/
- Right-click installer → **"Run as Administrator"** (required for API option to show\!)
- ✅ Check **"Install Npcap in WinPcap API-compatible Mode"**
- Complete installation and restart your computer

**Step 3: Install the Meter**
- Right-click the \`.exe\` → **"Run as Administrator"**
- Follow the installation wizard
- Creates desktop + start menu shortcuts

**Step 4: Launch & Use**
- Run **Infamous BPSR DPS Meter** (as Administrator recommended)
- Start or join Blue Protocol
- Change instance/channel once to trigger packet capture
- Meter will automatically track combat data\!

### 💡 Quick Tips
- ⚡ Works best with **VPN disabled** (100% accuracy)
- 🔄 First launch may require changing game instance once
- 📊 Click any player row to see detailed skill breakdown
- 💾 Sessions auto-save - switch between encounters via dropdown
- 📋 Copy stats to clipboard with one click

---

## 👨‍💻 For Developers

### 🔧 Build Instructions

**Recommended: WSL → Windows Hybrid Build**  
Development in WSL, building on Windows for best compatibility.

#### Quick Build (from WSL):
\`\`\`bash
# From WSL terminal in project directory
bash build-from-wsl.sh
\`\`\`

**What this does:**
1. Copies source from WSL to Windows temp directory
2. Installs dependencies on Windows (pnpm)
3. Builds Windows installer using electron-builder
4. Copies installer back to WSL and F:/DPS
5. Auto-detects version from package.json

#### Manual Build (Windows Native):
\`\`\`cmd
# Run in Windows Command Prompt (as Administrator)
pnpm install
pnpm dist
\`\`\`

#### Prerequisites:
- **Node.js:** v22.15.0+ (Windows)
- **pnpm:** Latest version
- **Windows 10/11:** Build must run on Windows
- **Code signing:** Certificate installed for signing .exe

📖 **Detailed Instructions:** [DEVELOPMENT.md](DEVELOPMENT.md)

### ⚠️ VPN Limitations
**VPNs interfere with packet capture - use with caution**

- ❌ **Not Recommended** - VPNs encrypt/redirect packets causing unreliable data
- ⚠️ **ExitLag** - "Legacy - NDIS" mode has partial compatibility (~70-80% accuracy)
- ❌ **Kernel-Level VPNs** - Completely incompatible (packets encrypted before capture)
- ✅ **Best Practice** - Disable VPN when using meter for 100% accuracy
- 💡 **Auto-Detection** - Automatically selects adapter with most traffic

**Note:** VPN compatibility is experimental. Data may be incomplete or inaccurate when VPN is active. For best results, disable VPN during combat analysis.

---

## 🌟 What Makes This Special?

This project builds upon and combines excellent work from the Blue Protocol community:
- ✨ **Modern UI** - Clean glassmorphism design with intuitive controls
- ⚡ **Robust Engine** - Accurate DPS/HPS tracking with proper packet parsing
- 🔧 **Performance** - Optimized rendering and window management
- 📊 **Session Management** - Auto-save and organize combat encounters
- 💊 **Healer Support** - Full HPS tracking with overheal metrics
- 🎯 **Player Prioritization** - Smart top-player tracking
- 💾 **Data Persistence** - Settings and sessions survive reinstalls

---

## 📜 License

This project is licensed under the **AGPL-3.0 License**.

