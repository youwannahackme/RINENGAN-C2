<div align="center">

# ⚡ WHOAMI_404 // RINENGAN C2

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=22&pause=1000&color=F87171&center=true&vcenter=true&width=600&lines=Next-Gen+Real-Time+Command+%26+Control+Framework;AES-256-GCM+Encrypted+WebSocket+Telemetry;Live+WebRTC+Screen%2C+Camera+%26+Audio+Streaming;Google+Authenticator+2FA+Hardened+Security)](https://git.io/typing-svg)

<p align="center">
  <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
  <a href="https://flask.palletsprojects.com"><img src="https://img.shields.io/badge/Flask-2.3%2B-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask"></a>
  <a href="https://socket.io"><img src="https://img.shields.io/badge/Socket.io-4.0%2B-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO"></a>
  <a href="https://webrtc.org"><img src="https://img.shields.io/badge/WebRTC-Real--Time-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC"></a>
  <a href="https://en.wikipedia.org/wiki/Galois/Counter_Mode"><img src="https://img.shields.io/badge/Encryption-AES--256--GCM-DC2626?style=for-the-badge&logo=shield&logoColor=white" alt="AES-256-GCM"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-7C3AED?style=for-the-badge" alt="License"></a>
</p>

[Overview](#-overview) • [Key Features](#-key-features) • [System Architecture](#-system-architecture--workflow) • [API & Socket Reference](#-rest-api--socketio-event-reference) • [Management & Reset Utilities](#-system-management--reset-utilities) • [Quick Start](#-quick-start--installation) • [Agent Build](#-agent-compilation--deployment) • [Cleanup](#-persistence-removal--cleanup-script)

</div>

---

## 📖 Overview

**Rinengan C2** is an enterprise-grade, asynchronous Command and Control telemetry platform engineered for authorized security researchers, red teams, and threat emulation operations. Built with a reactive **Flask-SocketIO** engine and native **WebRTC peer connections**, Rinengan C2 provides real-time desktop monitoring, live audio/video streaming, and stealth persistence management behind a zero-trust multi-factor authenticated control panel.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  WHOAMI_404 // RINENGAN C2 TELEMETRY ENGINE                                     │
│  ─────────────────────────────────────────                                      │
│  [+] Server Engine   : Flask-SocketIO (Async Threading / Eventlet)              │
│  [+] Cryptography    : AES-256-GCM (Authenticated Payload Encryption)           │
│  [+] Streaming Media : WebRTC DataChannels (Screen HD, Camera, Mic Audio)       │
│  [+] Hardened Auth   : Google Authenticator (TOTP 2FA) & Session Locking        │
│  [+] Reset Tools     : Dedicated Credential, Telemetry, and Full Wipe Utilities │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

<details open>
<summary><b>⚡ 1. Real-Time Telemetry & Encrypted Command Pipeline</b></summary>
<br>

* **Sub-Second Latency:** Bi-directional Socket.IO WebSockets deliver live terminal outputs, system diagnostics, and process updates instantly.
* **AES-256-GCM Encryption:** Every command payload (`uuid`, `command`, `params`) is encrypted client-side using per-agent AES-256-GCM secrets before transmission.
* **Dynamic Heartbeats & Jitter:** Configurable interval timing with random jitter algorithms prevents endpoint behavior profiling.
</details>

<details open>
<summary><b>🎥 2. High-Definition WebRTC Live Media Streaming</b></summary>
<br>

| Stream Type | Description | Controls |
| :--- | :--- | :--- |
| **🖥️ Live Screen** | Peer-to-Peer 1080p Desktop Capture over WebRTC | Quality (10-95%), FPS (1-30), Remote Input Control |
| **📷 Camera Feed** | WebRTC Video Stream from local webcams | Device Switching, Resolution Scaling |
| **🎙️ Live Audio** | Low-latency PCM Audio streaming | Device Selection, Buffer Adjustments |
</details>

<details open>
<summary><b>🔒 3. Hardened Zero-Trust Security Architecture</b></summary>
<br>

* **Google Authenticator (TOTP 2FA):** Destructive actions (`Agent Kill`, `Agent Purge`, `Emergency Global Killswitch`) require 6-digit TOTP validation.
* **Custom Operator Identity:** Setup wizard allows configuring custom operator usernames with seamless authentication.
* **Single-Active Session Tokens:** Active session tokens strictly enforce single-operator logins and automatically invalidate secondary sessions.
* **Rate Limiting & IP Filtering:** `Flask-Limiter` protects login and auth endpoints against brute-force attempts while enforcing remote IP whitelisting.
</details>

<details open>
<summary><b>🧹 4. Complete Agent Self-Destruct & Database Management</b></summary>
<br>

* **WMI & Persistence Removal:** One-click termination triggers full self-destruct routines wiping WMI Subscriptions, Scheduled Tasks, Registry Autorun keys, Defender Exclusions, binaries, and state files.
* **Database Management:** Purges command logs and database records (`db.session.delete(agent)`) and broadcasts `agent_deleted` events across all active panels.
</details>

---

## 🏗️ System Architecture & Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Op as Operator Browser
    participant Svr as Rinengan C2 Server
    participant DB as SQL Database
    participant Agt as Windows Agent

    Note over Agt,Svr: 1. Registration & Auth Handshake
    Agt->>Svr: Socket.IO Connect (agent_id, secret_key)
    Svr->>DB: Register / Update Agent State
    Svr-->>Op: Broadcast 'agent_update' event

    Note over Op,Agt: 2. Encrypted Command Execution
    Op->>Svr: POST /api/agents/{id}/command (command, params)
    Svr->>DB: Record Command (status: pending)
    Svr->>Agt: socket.emit('execute', payload: AES-GCM Encrypted)
    Agt->>Agt: Decrypt & Execute Process
    Agt-->>Svr: socket.emit('command_response', encrypted_result)
    Svr-->>Op: Broadcast 'command_result' to Panel

    Note over Op,Agt: 3. WebRTC Live Media Handshake
    Op->>Svr: emit('webrtc_offer')
    Svr->>Agt: Relay Offer SDP
    Agt->>Svr: emit('webrtc_answer')
    Svr->>Op: Relay Answer SDP
    Note over Op,Agt: Direct WebRTC P2P DataChannel Established

    Note over Op,Agt: 4. Destructive Kill / Self-Destruct
    Op->>Svr: DELETE /api/agents/{id} (Requires 2FA TOTP)
    Svr->>Agt: emit('kill') Socket Event & Encrypted Payload
    Svr->>DB: DELETE Agent & History
    Agt->>Agt: WMI / Task / Reg / File Wipe & Exit
```

---

## 📡 REST API & Socket.IO Event Reference

### REST Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET/POST` | `/setup` | Initial Operator Account Setup | No (First Time Only) |
| `GET/POST` | `/login` | Operator Authentication (Password + 2FA) | No |
| `GET` | `/logout` | Terminate active operator session | Session Token |
| `GET` | `/api/agents` | Retrieve all registered agents & status | Session Token |
| `POST` | `/api/agents/<id>/command` | Issue AES-256-GCM Encrypted Command | Session Token |
| `DELETE`| `/api/agents/<id>` | Terminate agent & purge database record | Session + 2FA TOTP |
| `POST` | `/api/agents/<id>/rename` | Update agent display alias | Session Token |
| `GET` | `/api/totp/status` | Check TOTP pairing status | Session Token |
| `POST` | `/api/totp/verify-setup` | Confirm initial TOTP pairing code | Session Token |

---

## 🛠️ System Management & Reset Utilities

The repository includes three dedicated Python maintenance scripts located in the root directory for granular database and credential operations:

### 1. Reset Operator Credentials & 2FA Only (`reset_user.py`)
Resets or updates operator credentials and clears Google Authenticator 2FA settings without touching agents, commands, or telemetry tables.
```bash
# Reset with custom username and password
python reset_user.py <username> <password>

# Example:
python reset_user.py whoami IMF10192006
```
*(Running without arguments defaults to username `admin` and password `admin123`)*

### 2. Reset Database Telemetry Data Only (`reset_db.py`)
Wipes agent logs, command execution history, webhooks, and keylogs while **preserving** operator user accounts, passwords, and 2FA configurations.
```bash
python reset_db.py
```

### 3. Full System Reset (`reset_all.py`)
Performs a complete wipe of all database tables (including operator accounts). Running `python app.py` after executing this script automatically displays the **Initial Setup Wizard (`/setup`)** on launching the control panel.
```bash
python reset_all.py
```

---

## 🚀 Quick Start & Installation

### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/your-org/rinengan-c2.git
cd rinengan-c2

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=33875
SECRET_KEY=generate_random_secure_key_here
ALLOWED_IPS=127.0.0.1,192.168.1.0/24
```

### 3. Launching the C2 Server
```bash
python app.py
```
> Access the Control Panel at `http://127.0.0.1:33875`. If configuring a fresh installation, complete the setup wizard at `/setup` to pair your 2FA authenticator app.

---

## 💻 Agent Compilation & Deployment

```bash
# 1. Install agent dependencies
pip install -r agent/requirements.txt

# 2. Test execution in standalone mode
python agent/agent.py --server http://127.0.0.1:33875

# 3. Build standalone EXE using PyInstaller
cd agent
pyinstaller agent.spec
```

---

## 🧼 Persistence Removal & Cleanup Script

To manually clean up agent persistence mechanisms on a test target:

```cmd
# Run as Administrator in Command Prompt
remove_persistence.bat
```

This automated script performs:
1. Process termination (`securityhealthservice.exe`, `securityhelper.exe`, `scrcons.exe`, watchdog instances).
2. Scheduled Task deletion (`Microsoft Security Health Service`, `HealthServiceRecovery`).
3. Registry Autorun removal (`HKCU` & `HKLM` Run keys).
4. Windows Defender exclusion reversal (`Remove-MpPreference`).
5. WMI Filter, Consumer, Binding, and Timer cleanup via PowerShell CIM instances.
6. Reparse point / junction unhooking (`GhostRoot\A`, `GhostRoot\B`).
7. Complete file & log wipe (`/A /F /Q` forced deletion of all state/temp files).

---

## ⚠️ Legal & Security Disclaimer

> **IMPORTANT NOTICE:** This software is designed strictly for **authorized security research, red team emulations, and defense validation**. Deployment of this tool against targets without prior written authorization from system owners is strictly prohibited and violates national and international cybercrime laws. The authors accept no responsibility or liability for unauthorized usage or damage.

---

<div align="center">

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

**WHOAMI_404 // RINENGAN C2 FRAMEWORK**

</div>
