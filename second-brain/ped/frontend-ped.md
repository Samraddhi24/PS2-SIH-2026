# Product Engineering Document (PED): Frontend Specifications

**Product Name:** POLAR-OPS (Integrated Polar Expedition Command Centre)  
**Hackathon Target:** Smart India Hackathon 2026 · PS 26062  
**Target Organization:** Ministry of Earth Sciences (MoES) / NCPOR  
**Document Type:** Frontend Product Engineering Document (PED)  
**Scope:** Client-Side Presentation, State Synchronization & UI Architecture  

---

## 1. Product & UI Requirements

### 1.1 Problem Context
Scientific and logistical field teams in Antarctica and Arctic regions operate in sub-zero climates with frequent radio blackouts, blizzard disruptions, and zero cellular networks. Central station commanders require a unified dashboard to track supply status, team safety, and overall mission viability.

### 1.2 Core Product Capabilities
* **Dual Simultaneous Perspective:** View both the station command centre and an in-field operative's rugged tablet simultaneously on a single desktop screen.
* **Continuous Operational Score:** Calculate and display the 0–100% Mission Readiness Score (MRS) derived from live inventory, fuel buffers, trauma kits, overdue check-ins, transit cargo, and radio heartbeats.
* **Zero-Signal Survivability:** Complete field operations (cargo scanning, stock logging, check-in, SOS) must succeed offline without network errors.
* **Immediate Audio/Visual Alerting:** Audio synthesizer emitting dual 880Hz square-wave alarm tones upon active emergencies.
* **Thermal Barcode Generation:** Render crisp vector QR codes for cargo tags on demand.

---

## 2. Pages, Screens & Interface Blueprint

### 2.1 Command Centre Dashboard
| Screen / Tab | Primary UI Elements | Expected Interactions |
| :--- | :--- | :--- |
| **Command Centre** (`#v-command`) | Polar Map SVG, Circular Readiness Ring, KPI tiles, Alert list, Camp status cards, Activity log. | Filter map between Expedition Route and All Stations; clear non-critical alerts; view live log. |
| **Cargo & QR** (`#v-cargo`) | New cargo registration form, Manifest table, Filter segments (`All`, `In Transit`, etc.), Label print trigger. | Register batches of crates; generate automatic QR tags; open thermal printer dialog (`window.print()`). |
| **Stock & Thresholds** (`#v-stock`) | Camp-wise inventory cards, visual gauge bars with threshold lines, numeric threshold inputs. | Adjust emergency low-stock threshold per item; triggers instantaneous alert re-evaluation if breached. |
| **Personnel & Comms** (`#v-people`) | Crew registration form, Active personnel roster, Field tablet comms status, Historical SOS audit table. | Onboard new personnel; review overdue status (>6 hours); inspect tablet telemetry. |
| **Expedition Plan** (`#v-plan`) | Interactive polar map route plotter, Drag/toggle waypoint list, Popup coordinate camp creation modal. | Click anywhere on the Antarctic map to place new field camps or emergency fuel depots; reorder waypoints. |

### 2.2 Rugged Field Tablet
| Screen Name | Content & Layout | Available Actions |
| :--- | :--- | :--- |
| `login` | Roster cards with crew member name, team, and camp. | Tap crew card to authenticate and load personal seed state. |
| `home` | 5 large tactile touch tiles + emergency notice if SOS is active. | Open Scan, Check-in, Stock, Location, or Emergency SOS screens. |
| `scan` | Search input form + quick-select manifest list. | Filter cargo items; tap item to open Asset Detail. |
| `asset` | High-contrast QR tag badge, current location, destination. | Tap `Mark in transit`, `Delivered at [Camp]`, `Delayed`, or `Missing`. |
| `checkin` | Camp selection cards + Check In / Check Out action buttons. | Check into current camp or check out into traverse field. |
| `stock` | Camp selector chips + stock item list with current quantities. | Select item to adjust; opens numeric amount pad. |
| `amount` | Stepper buttons (`+5`, `+10`, `+25`, `+50`), +/- controls, Used/Received toggle. | Commit stock change locally and enqueue sync transaction. |
| `location` | Lat/Long coordinates and estimated station proximity. | Broadcast GPS coordinate heartbeat to command centre. |
| `sos` | Severity selector (`Low`, `Medium`, `High`, `Critical`) + 2-second hold radial trigger. | Hold radial button for 2 seconds to fire emergency distress beacon. |
| `queue` | Local queue inspection list showing unsynced transactions. | View pending actions awaiting radio/satellite link restoration. |

---

## 3. User Journeys

### Journey 1: Field Operative Cargo Delivery in a Blizzard
1. Glaciologist Arjun Mehta signs into the rugged tablet at Field Camp B.
2. Signal is lost due to an approaching blizzard (user taps `Lose signal`).
3. Arjun scans crate `NCPOR-FOOD-005` and taps `Delivered at Field Camp B`.
4. App optimistically records delivery, updates local Camp B rations, and displays `"1 pending"`.
5. Arjun logs that 15 L of Jet A1 fuel were consumed by the field snowmobile (`"2 pending"`).
6. Antenna link is re-established (user taps `Restore signal`).
7. Device flushes both events automatically:
   - Command centre logs both updates tagged with `offline-synced`.
   - Low fuel alarm triggers at Camp B.
   - Mission Readiness Score drops dynamically with detailed reasoning.

### Journey 2: Emergency SOS Evacuation Trigger
1. Field assistant Aditya Joshi encounters a crevassed route.
2. Opens `Emergency SOS` screen on tablet, selects `Critical`.
3. Press and holds the central red SOS button for 2.0 seconds.
4. Tablet vibrates and displays confirmation of queued/sent distress.
5. Base Command Dashboard flashes an emergency crimson banner and emits an audible 880Hz siren.
6. The operator marker on the live polar map pulses with a radiating red halo.
7. Expedition Leader taps `Acknowledge`; the tablet updates to indicate rescue is being coordinated.

---

## 4. Design System Specifications

### 4.1 Color Palette
* **Canvas Dark (`--night`):** `#0c1826`
* **Card Surface (`--shelf`):** `#13243a`
* **Control Surface (`--shelf-2`):** `#1a3150`
* **Borders / Separators (`--ridge`):** `#24405f`
* **Primary Text (`--ice`):** `#e4edf5`
* **Secondary Text (`--frost`):** `#8da3ba`
* **Action Accent (`--signal`):** `#ff8a1f`
* **Success / Online (`--ok`):** `#3cb67b`
* **Caution / Transit (`--warn`, `--transit`):** `#e9b63b`, `#5aa9e6`
* **Emergency Alarm (`--sos`):** `#f04444`

### 4.2 Typography & Spacing
* **Font Family:** System standard stack: `"Segoe UI", "Noto Sans", Roboto, sans-serif`.
* **Tabular Figures:** `font-variant-numeric: tabular-nums` enforced to prevent layout jitter during counter animations.
* **Touch Dimensions:**
  * Field Tablet Main Tiles: $\text{Min Height } 112\text{px}$, Padding $13\text{px}$.
  * Primary Action Buttons: $\text{Min Height } 62\text{px}$, Font Size $17\text{px}$, Font Weight 800.
  * Hold-to-SOS Radial Circle: $230\text{px} \times 230\text{px}$.

---

## 5. Error, Loading, and Empty States

| Context | Empty State Representation | Error / Alert State Representation |
| :--- | :--- | :--- |
| **Cargo Manifest** | `"No cargo with this status."` table placeholder. | Badges for `.st.Delayed` (yellow) and `.st.Missing` (red). |
| **Active Alerts** | `"No open alerts."` with subdued border. | Crimson left-border `.alerts li.Critical` with dismiss controls. |
| **Sync Queue** | `"Nothing waiting. Base has every update."` | Highlighted queue items with `.s` class and red border for pending SOS. |
| **Audio Subsystem** | Graceful fallback if Web Audio API is blocked prior to user interaction. | Automatic unlock listener attached to first `pointerdown` interaction. |

---

## 6. Performance & Accessibility Metrics

* **Zero External HTTP Requests:** All assets, fonts, icons, and libraries are locally bundled; zero CDNs are queried, guaranteeing full performance during total internet blackouts.
* **Bundle Footprint:** Under $200\text{KB}$ total uncompressed size across HTML, CSS, JavaScript, and QR generator.
* **DOM Paint Efficiency:** SVG map updates and circular readiness ring animations utilize CSS transforms and `stroke-dashoffset` driven by `requestAnimationFrame`.
* **WCAG Compliance:** High-contrast palette exceeds WCAG AAA ratio ($> 11:1$ on text surfaces).

---

## 7. Frontend Testing Strategy

1. **Unit Logic Testing:** Validate Mission Readiness math calculations against edge cases (zero fuel, expired medical batches, all personnel in active SOS).
2. **Offline Simulation Testing:** Verify that local storage correctly persists queued items across browser reloads when offline.
3. **Responsive Breakpoint Testing:** Test view rendering across $1920\text{px}$ (Desktop dual screen), $1024\text{px}$ (Tablet split view), and $390\text{px}$ (Mobile single column).
4. **Thermal Print Verification:** Validate `@media print` layout on Chrome/Edge Print Preview to ensure QR barcodes conform to standard sticker dimensions without clipping.

---

## 8. Deployment Requirements

* **Zero Build Pipeline:** Compatible with any static file server (GitHub Pages, Apache, Nginx, `python -m http.server`, `npx serve`).
* **Cross-Browser Standards:** Verified on Chromium (Chrome/Edge $\ge 90$), Firefox ($\ge 88$), and WebKit (Safari $\ge 14$).
