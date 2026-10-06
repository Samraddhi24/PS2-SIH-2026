# ❄️ POLAR-OPS: Integrated Polar Expedition Command Centre & Asset Logistics System

<div align="center">

**Smart India Hackathon 2026 &middot; Problem Statement ID: 26062**  
**Organization:** Ministry of Earth Sciences (MoES) / National Centre for Polar and Ocean Research (NCPOR)  
**Team Name:** Mind Mates &middot; **Category:** Software / Logistics & Remote Mission Operations

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg?style=for-the-badge&logo=target)](https://sih.gov.in)
[![MoES / NCPOR](https://img.shields.io/badge/MoES-NCPOR-0052cc.svg?style=for-the-badge&logo=globe)](https://ncpor.res.in)
[![Demo](https://img.shields.io/badge/Live-Demo_Ready-brightgreen.svg?style=for-the-badge&logo=google-chrome)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 📌 Executive Summary

**POLAR-OPS** is an expedition command centre and resilient field logistics system engineered specifically for the extreme conditions of Antarctic and Arctic research expeditions (e.g., Maitri Station, Bharati Station, India Bay, and remote field traverse camps). 

Operating in an environment characterized by sub-zero temperatures (down to -60°C), blizzards, magnetic anomalies, and prolonged satellite blackouts, POLAR-OPS combines:
- **Offline-First Field Mobility:** Zero-signal local caching, glove-friendly tactile UI, and cryptographic timestamped action queues.
- **Resilient Cargo & Asset Tracking:** Quick-response (QR) scanning, thermal printable manifests, and dynamic stock balance adjustments.
- **Dynamic Mission Readiness Score (0–100%):** A real-time, 6-driver weighted mathematical algorithm tracking expedition survival integrity.
- **Fail-Safe Emergency SOS Protocol:** Immediate high-priority queue preemption, audible acoustic sirens (Web Audio API), and visual cartographic beaconing.

---

## 🎯 Problem Statement (PS 26062)

Scientific expeditions dispatched by the **National Centre for Polar and Ocean Research (NCPOR)** face hazardous operational hurdles:
1. **Connectivity Deserts:** Field traverse teams operate dozens or hundreds of kilometres away from Maitri or Bharati stations without cellular coverage and only sporadic satellite uplink windows.
2. **Critical Supply Chains:** Fuel (Jet A1 and generator diesel), medical trauma supplies, and specialized rations are finite and life-critical. Stockout in blizzard conditions can be fatal.
3. **Personnel Safety & Accountability:** Geologists, glaciologists, and atmospheric researchers face crevasse falls and rapid-onset whiteout conditions; traditional paper logs cannot alert command centres of overdue check-ins.
4. **Fragmented Operations:** Expedition leaders traditionally juggle separate spreadsheets, radio transcripts, and static paper manifests with no unified operational picture.

### The POLAR-OPS Solution
POLAR-OPS unites central mission command with isolated field operatives through an **idempotent, offline-reconciled operational loop** featuring a dual-screen command-and-field simulation.

---

## 👥 Team Information — Team Mind Mates

| Member Name | Hackathon Role | Primary Domain / Focus Area |
| :--- | :--- | :--- |
| **Arjun Mehta** | Team Lead & Full-Stack Architect | Offline Sync Protocol, State Architecture & Algorithmic Engines |
| **Dr. Vikram Menon** | Systems Analyst & Domain Lead | Emergency SOS Protocol, Medical Logistics & Safety Standards |
| **Sneha Iyer** | Frontend & UI/UX Engineer | Polar-Night Design System, Tactile & Glove-Friendly Accessibility |
| **Rohan Kulkarni** | Logistics & Quality Assurance | Cargo Manifest Engine, QR Barcode Standard & Stock Auditing |
| **Priya Nair** | Documentation & Data Engineer | Cartographic SVG Graticules & Mission Readiness Formula Tuning |
| **Aditya Joshi** | DevOps & Deployment Specialist | Progressive Web App (PWA) Standards, Cross-Browser Compatibility |

---

## 🚀 Key Features

### 1. Command Dashboard (Base Station & HQ)
* **Live Polar Cartography:** Custom polar coordinate projector with SVG Antarctica graticules, route lines, station rhombuses, and real-time personnel beacon halos.
* **Mission Readiness Score (MRS):** Algorithmic multi-factor operational index computed continuously across 6 critical operational drivers.
* **Automated Alert Arbiter:** Real-time triggers for critical fuel depletion, expiring medical stock (≤ 14 days), delayed/missing cargo, and overdue personnel check-ins (> 6 hours).
* **Expedition Route Planner:** Interactive waypoint placement directly on the polar projection with drag/toggle reordering.
* **Thermal Label Printer:** Browser-native generation of high-density QR tags formatted for thermal sticker label sheets (`@media print`).
* **Role-Based Access Control:** Dual perspective mode toggling between Expedition Leader (Dr. Anjali Rao) and Medical/Safety Responder (Dr. Vikram Menon).

### 2. Rugged Field App (Tablet / Mobile Simulator)
* **100% Offline-First Architecture:** Field personnel can record cargo movements, inventory deltas, and check-ins without connectivity.
* **Glove-Friendly Touch Interface:** High-contrast buttons (≥ 50px targets), oversized touch pads, and stepped increment dials designed for sub-zero glove operation.
* **One-Tap QR Cargo Scanner:** Rapid tag query (`NCPOR-FOOD-005`, `NCPOR-FUEL-001`) with immediate local state adjustment.
* **Guaranteed Event Delivery:** Local FIFO queue storing actions until satellite or UHF/VHF data connection is re-established.
* **Tactile Hold-to-Activate SOS:** 2-second press-and-hold trigger with visual radial sweep and vibration feedback to eliminate false alarms.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Remote_Field_Environment["❄️ Remote Field Environment (Zero Connectivity)"]
        A[Crew Rugged Tablet] -->|Action Triggered| B[Local Event Queue]
        B -->|Optimistic UI Update| C[Local Storage State]
        A -->|Hold 2s| SOS[Emergency SOS Beacon]
        SOS -->|High Priority Tag| B
    end

    subgraph Sync_Engine["🔄 Sync Reconciliation Engine"]
        B -->|Signal Restored / WiFi / Iridium| D[POST /api/sync Batch Dispatch]
        D --> E{Idempotency Filter}
        E -->|Already Processed?| F[Acknowledge Duplicate]
        E -->|New Action?| G[SOS-First Priority Sorter]
        G --> H[Timestamp Ordering Engine]
        H --> I[Latest-Wins Cargo Conflict Arbiter]
    end

    subgraph Command_Centre["🏢 Central Command Base (Maitri / HQ)"]
        I --> J[Central Mission Database]
        J --> K[Mission Readiness Score Engine]
        J --> L[Automated Alert Arbiter]
        J --> M[Cartographic SVG Polar Map]
        L -->|Critical SOS / Low Fuel| N[Web Audio Synthesizer Siren]
        K --> O[Executive KPI Dashboard]
    end
```

### Data Synchronization Guarantees
1. **SOS-First Priority:** Even if 50 cargo scans are waiting in the offline queue, emergency SOS payloads are prioritized at position zero upon link restoration.
2. **Idempotent Deduplication:** Every mutation carries a UUID (`client_id`). Server/command engine records processed IDs to eliminate double-counting on network flakiness.
3. **Deterministic Conflict Resolution:** When two field tablets update the same cargo package while disconnected, the newest timestamped status wins (`latest-wins`), and older events are logged in the audit trail without corrupting inventory.
4. **Autonomous Stock Replenishment:** Marking an in-transit cargo crate as "Delivered at Field Camp B" automatically increments the stock ledger of Camp B and re-evaluates low-stock alert thresholds.

---

## 🧮 Mission Readiness Score (MRS) Formula

The Mission Readiness Score is an aggregate index ($0 \le \text{MRS} \le 100$) weighted across 6 operational pillars:

$$\text{MRS} = \sum_{i} \left( W_i \times S_i \right)$$

| Operational Driver | Weight ($W_i$) | Scoring Logic & Penalty Conditions |
| :--- | :---: | :--- |
| **Inventory ($S_{\text{inv}}$)** | **20%** | Average stock on hand across camps relative to operational targets. Stock below emergency threshold is penalized to 25% value. |
| **Fuel ($S_{\text{fuel}}$)** | **20%** | Dual calculation: 50% based on expedition average, 50% based on the single weakest camp. Jet A1 and generator diesel critical. |
| **Medical ($S_{\text{med}}$)** | **15%** | First aid and trauma kit availability combined with expiration penalties for medicines expiring within 14 days. |
| **Personnel ($S_{\text{crew}}$)** | **15%** | Active personnel safety ratio. Deductions applied for check-ins overdue (> 6 hours) and personnel trapped in active SOS events. |
| **Cargo ($S_{\text{cargo}}$)** | **20%** | Supply chain efficiency score: Delivered (100%), In Transit (70%), Registered (60%), Delayed (20%), Missing (0%). |
| **Communications ($S_{\text{comms}}$)** | **10%** | Tablet telemetry heartbeat recency across all deployed field devices. |

---

## 💻 Technology Stack

* **Front-End Presentation:** HTML5 Semantic Architecture, CSS3 Polar-Night Theme (Custom Properties, Glassmorphism, Tabular Numerals).
* **Core Application Logic:** ES6+ JavaScript (Modular IIFE, Zero external runtime dependencies).
* **Vector Cartography:** Pure Mathematical SVG Antarctic Polar Projection with Graticules, Dynamic Scaling, and Radial Wave Halos.
* **QR Code Generation:** Kazuhiko Arase QR Generator Engine (MIT License).
* **Audio Telemetry:** Web Audio API Frequency Oscillator (Square-wave 880Hz acoustic alarm for emergency SOS).
* **Persistence & State:** Browser `localStorage` engine simulating a persistent embedded edge database.
* **Printing Engine:** CSS `@media print` layout engineered for standard industrial and thermal barcode label rolls.

---

## 📂 Project Structure

```text
PS2 SIH 2026/
├── index.html            # Unified dual-interface stage (Command Dashboard + Field Phone)
├── polar-ops.js          # Core monolithic application engine (Sync, Map, Readiness, Audio)
├── styles.css            # Dark polar-night theme, glove-friendly tactile UI & responsive grid
├── qrcode-generator.js   # Kazuhiko Arase client-side QR generation engine
├── commit.md             # Standardized atomic Git commit messages for deployment (gitignored)
├── .gitignore            # Production environment, build, and temporary file exclusions
└── README.md             # Comprehensive SIH 2026 submission documentation
```

---

## ⚡ Fast-Track 3-Minute Walkthrough for SIH Judges

The interactive prototype includes an automatic **guided tour strip** at the top (`Try it:`) that ticks off milestones in real time:

1. **Sign In:** On the simulated phone on the right, tap **Arjun Mehta** (Glaciologist, Field Camp B).
2. **Scan Cargo:** Tap **Scan cargo**, select crate **NCPOR-FOOD-005**, and tap **Mark in transit**. The Command Dashboard on the left immediately reflects the updated supply line.
3. **Simulate Outage:** Tap **Lose signal** on the tablet header to enter disconnected Antarctic traverse mode.
4. **Offline Cargo Delivery:** Tap **NCPOR-FOOD-005** again and tap **Delivered at Field Camp B**. Notice the badge displays `"1 pending"` and state is stored locally.
5. **Log Fuel Consumption:** Tap **Update stock** &rarr; **Jet A1 fuel** &rarr; **Used 15 L** &rarr; **Save**. Badge displays `"2 pending"`.
6. **Re-establish Signal & Auto-Sync:** Tap **Restore signal**. Both actions flush to the server automatically. Notice:
   - Updates are flagged with the `offline-synced` badge in the activity log.
   - A low-fuel alert triggers at Field Camp B.
   - The **Mission Readiness Score drops from 87% to 81%** with the exact explanation shown in the breakdown card.
7. **Trigger Emergency SOS:** Tap the **SOS** tile on the phone, select **Critical**, and hold the central button for 2 seconds. The Command Centre launches an audible siren, turns the screen banner red, and pinpoints the operative on the map.
8. **Acknowledge Emergency:** On the dashboard banner, tap **Acknowledge**. The field tablet instantly receives confirmation that base has dispatched assistance.

---

## 🛠️ Installation & Local Execution

POLAR-OPS requires **zero third-party dependencies, zero package managers, and no build pipeline**. It runs directly in modern browsers.

### Option A: Direct Browser Launch
Simply double-click [`index.html`](file:///c:/Users/shyam/Desktop/PS2%20SIH%202026/index.html) or right-click &rarr; *Open with* &rarr; Google Chrome, Microsoft Edge, or Mozilla Firefox.

### Option B: Local HTTP Server (Python)
```powershell
# Navigate to the project root
cd "c:\Users\shyam\Desktop\PS2 SIH 2026"

# Launch lightweight server
python -m http.server 8000
```
Open your browser at `http://localhost:8000`.

### Option C: Node.js (npx serve)
```powershell
npx -y serve .
```

---

## 🌐 Deploy to GitHub Pages (One-Click)

1. Create a public repository on GitHub named `polar-ops`.
2. Push this directory to the `main` branch.
3. In your GitHub repository, navigate to **Settings** &rarr; **Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
5. Select branch `main` and directory `/ (root)`, then click **Save**.
6. Within 60 seconds, your live demo is operational at:
   `https://<your-github-username>.github.io/polar-ops/`

---

## 🖼️ Media & UI Mockups

### Dual Operational Interface
```text
+-------------------------------------------------------------+-----------------------+
|  POLAR-OPS Command Centre                                    |  Field Tablet (Phone) |
|  [Score: 87% READY]  [Active Alerts: 2]                      |  [Online] [Synced]    |
|                                                             |                       |
|  +---------------------------+  +------------------------+  |  +-----------------+  |
|  | Live Antarctic Polar Map  |  | Readiness Breakdown    |  |  | [Scan Cargo]    |  |
|  | (SVG Graticules, Route)   |  | Fuel: 82%  Stock: 90%  |  |  | [Check In]      |  |
|  |                           |  | Comms: 95% Cargo: 80%  |  |  | [Update Stock]  |  |
|  +---------------------------+  +------------------------+  |  | [EMERGENCY SOS] |  |
|                                                             |  +-----------------+  |
|  [Cargo Manifest] [Stock Thresholds] [Personnel Roster]     |                       |
+-------------------------------------------------------------+-----------------------+
```

---

## 🔮 Future Scope & Production Roadmap

* **Hardware & Satellite Mesh Integration:** Direct UART/Bluetooth interface with Iridium Edge / RockBLOCK satellite transceivers and LoRa 868MHz local camp mesh nodes.
* **Native Field Deployment:** Packaging the field module as a cross-platform Flutter application backed by encrypted SQLite (SQLCipher).
* **PostgreSQL / PostGIS Command Cloud:** Scalable backend with spatial geospatial tracking of crevasse fields and weather radar overlays.
* **Computer Vision Optical Scanning:** Integration of real-time camera-based QR and barcode scanning with dirty/ice-obscured code reconstruction.
* **Predictive Stock Depletion (AI):** Machine learning models forecasting fuel and ration exhaustion based on real-time ambient blizzard temperatures.

---

## 🌍 Real-World Impact

* **100% Data Survivability:** Zero telemetry loss during multi-day blizzards and magnetic ionosphere disruptions.
* **Drastic SOS Latency Reduction:** Critical emergency coordinates broadcast within seconds of communication link acquisition.
* **Human-Error Elimination:** Barcode-based asset tracking replaces error-prone handwritten paper cold-room ledgers.
* **Direct Alignment with MoES & NCPOR Goals:** Supports sustainable Indian polar research across Dakshin Gangotri, Maitri, and Bharati stations.

---

## 📜 License

This project is licensed under the **MIT License** — see the open-source license standards for full permissions. Developed for **Smart India Hackathon 2026**.
