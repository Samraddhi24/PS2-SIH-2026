# Frontend Architecture Document: POLAR-OPS

**Project:** POLAR-OPS (Smart India Hackathon 2026 · PS 26062)  
**Classification:** Frontend Architectural Specification  
**Tech Stack:** Semantic HTML5, Vanilla CSS3 (Custom Design Tokens), ES6+ JavaScript, Web Audio API, SVG Cartography

---

## 1. High-Level Architecture Overview

POLAR-OPS is engineered as an **offline-first, zero-dependency, dual-screen client architecture**. It operates entirely within modern web standards, eliminating external build dependencies, compilers, or server prerequisites.

```
+---------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER                                 |
|                                                                                       |
|   +------------------------------------+    +-------------------------------------+   |
|   |         COMMAND DASHBOARD          |    |          FIELD TABLET APP           |   |
|   |  - Polar SVG Map Projection        |    |  - Glove-friendly Tactile UI        |   |
|   |  - Readiness Ring & Drivers        |    |  - QR Code Scanner & Manifest       |   |
|   |  - KPI Telemetry Tiles             |    |  - Stock Adjustment Steppers        |   |
|   |  - Alert Arbiter & SOS Banner      |    |  - Hold-to-Trigger SOS (2s Radial)  |   |
|   |  - Waypoint Route Editor           |    |  - Telemetry & Location Dispatch    |   |
|   +------------------------------------+    +-------------------------------------+   |
|                     ▲                                          ▲                      |
+---------------------|------------------------------------------|----------------------+
|                     ▼                                          ▼                      |
|                                   DATA & LOGIC LAYER                                  |
|                                                                                       |
|   +------------------------------------+    +-------------------------------------+   |
|   |       MISSION COMMAND ENGINE       |    |          OFFLINE SYNC QUEUE         |   |
|   |  - Readiness Score Formula (6-way) |    |  - FIFO Action Enqueueing           |   |
|   |  - Low Stock & Comms Alert Arbiter |    |  - Cryptographic Client IDs (UUID)  |   |
|   |  - Emergency Siren (880Hz WebAudio)|    |  - Idempotent Server Deduplication  |   |
|   |  - Seed Manifest & Route Generator |    |  - Offline / Online Flusher         |   |
|   +------------------------------------+    +-------------------------------------+   |
|                                             |                                         |
|                                             ▼                                         |
|                             +-------------------------------+                         |
|                             |      LOCAL STORAGE CACHE      |                         |
|                             |   Key: "polarops-demo-v1"     |                         |
|                             +-------------------------------+                         |
+---------------------------------------------------------------------------------------+
```

---

## 2. Component Structure

The frontend components are categorized into **Structural Layout**, **Command Dashboard Modules**, and **Field Mobile Screens**:

### A. Structural Layout Components
* **`AppHeader`**: Sticky top navigation bar containing branding, acting role selector (`#acting`), audio alarm toggle (`#mute`), database reset button (`#reset`), and the 8-step judge walkthrough strip (`#tour-steps`).
* **`ResponsiveStage`**: Split container providing side-by-side execution on desktop ($\ge 1050\text{px}$) and tab-switched views (`show-dash` / `show-field`) on mobile.

### B. Command Dashboard Modules
1. **`KpiGrid`**: Computes and renders 6 high-level cards (Total Personnel, Overdue Check-ins, Cargo Delivered, In Transit, Delayed/Missing, Active SOS).
2. **`ReadinessRing`**: Animated SVG circle showing the composite Mission Readiness Score ($0\text{--}100\%$) with driver breakdowns and qualitative explanations.
3. **`PolarMap`**: Coordinate projector converting latitude/longitude coordinates into planar coordinates for the Antarctic region, rendering ice shelf stations, routes, and pulsating crew markers.
4. **`AlertsList`**: Categorized operational alerts (Critical, High, Medium, Low) with dismiss/acknowledge controls for managers.
5. **`CargoManifest`**: Tabular manifest of all tracked containers with status badges, search filtering, and thermal barcode printing.
6. **`StockLedger`**: Visual inventory gauges for every camp, indicating safe buffers and low-stock alarm thresholds.
7. **`WaypointPlanner`**: Click-to-add polar map tool allowing expedition commanders to insert emergency camps or fuel depots.

### C. Field Tablet Screen Controllers
* **`ScreenLogin`**: Rapid crew member authentication screen.
* **`ScreenHome`**: Tactile dashboard tiles for Field Operations (Scan, Check-in, Stock, Location, SOS).
* **`ScreenScan` & `ScreenAsset`**: QR tag lookup with one-tap status transitions (`In Transit`, `Delivered`, `Delayed`, `Missing`).
* **`ScreenStock` & `ScreenAmount`**: Stepper-based fuel and ration logger with quick-add buttons (`+5`, `+10`, `+25`, `+50`).
* **`ScreenSos`**: High-priority radial countdown button requiring a continuous 2-second touch gesture to prevent accidental alarms.
* **`ScreenQueue`**: Device connectivity monitor displaying unsynced pending transactions.

---

## 3. State Management

The application employs an **Event-Driven Optimistic State Architecture**:

### State Schemas
```typescript
interface ApplicationState {
  srv: {
    seq: number;
    expedition: { name: string; region: string; status: string };
    camps: Camp[];
    route: number[];
    people: Person[];
    cargo: CargoItem[];
    inv: InventoryItem[];
    alerts: Alert[];
    sos: SosEvent[];
    activity: ActivityItem[];
    devices: Record<string, Device>;
    processed: Record<string, string>; // Idempotency hash map
  };
  fld: {
    user: number | null;
    boot: BootData | null;
    queue: QueuedAction[];
    offline: boolean;
    everOffline: boolean;
    lastSync: string | null;
  };
  tour: string[];
}
```

### Mutation Flow
1. User triggers an action on the field tablet (e.g. `Delivered at Field Camp B`).
2. Action is stamped with a UUID `client_id`, local ISO timestamp, and offline status.
3. Action is enqueued into `fld.queue`.
4. State is applied **optimistically** to `fld.boot` so the field operator sees immediate feedback.
5. The state is serialized to `localStorage.setItem('polarops-demo-v1', ...)`.
6. If the device has connectivity, `flush()` is dispatched immediately; if offline, actions remain in the local queue until the user clicks **Restore signal**.

---

## 4. Routing Strategy

* **Command Dashboard**: Controlled via class toggles on tab buttons (`.tabs button[data-tab]`) displaying corresponding `<div class="view" id="v-*">` sections. State changes trigger granular re-renders of the visible view.
* **Field Tablet**: Managed through a lightweight internal screen router:
  ```javascript
  function fieldGo(screenName) {
    fscreen = screenName;
    const routes = { login, home, scan, asset, checkin, stock, amount, location, sos, queue };
    (routes[screenName] || routes.home)();
    renderNet();
  }
  ```

---

## 5. Styling Approach & Design Tokens

* **Engine**: Pure Vanilla CSS3 with standard CSS Custom Properties (`:root`).
* **Theming**: Tailored **Polar-Night** dark mode optimized for outdoor glare, snow blindness reduction, and high contrast.
* **Layout Geometry**: CSS Grid for multi-column dashboards (`.kpis`, `.cmd-grid`, `.stage`) and Flexbox for toolbars and badge tags.
* **Typography**: Clean system sans-serif font stack with tabular numeral alignment (`font-variant-numeric: tabular-nums`) to prevent jitter in live telemetry counters.

---

## 6. Responsive Strategy

* **Desktop ($\ge 1051\text{px}$)**: Full dual-column split view displaying the command dashboard alongside the field tablet.
* **Tablet / Small Laptop ($701\text{px} \text{ to } 1050\text{px}$)**: Layout switches to a single column with an interactive top switch bar (`Split view`, `Command Dashboard`, `Field Device`).
* **Mobile ($\le 700\text{px}$)**:
  * Phone chassis border is removed; field app expands to 100% viewport width.
  * KPI grid shrinks from 6 columns down to 2 columns.
  * Map font sizes scale up for touch readability.
* **Print Media (`@media print`)**:
  * Hides all dashboard chrome and interactive elements.
  * Activates `#print-sheet` into a 3-column sticker layout for thermal barcode label printing.

---

## 7. Reusable Components & UI Patterns

* **`ToastNotification`**: Self-expiring floating alerts with status accents (`.ok`, `.err`, `.warn`).
* **`SegmentedButton`**: Accessible pill toggles (`.seg button`) used across map filtering and manifest sorting.
* **`BadgePill`**: Status badges (`.st.Delivered`, `.st.InTransit`, `.st.Overdue`) with distinct color borders.
* **`OfflineBadge`**: `.off-badge` indicating an action was performed disconnected and synced subsequently.

---

## 8. Accessibility (a11y) Considerations

* **Touch Targets**: All interactive field buttons meet or exceed the $48\text{px} \times 48\text{px}$ minimum (primary field buttons are $\ge 62\text{px}$ for sub-zero glove operation).
* **Keyboard Accessibility**: Custom buttons support `Space` and `Enter` key events.
* **Focus States**: High-visibility `:focus-visible` outline in `--signal` orange (`2px solid var(--signal)`).
* **Contrast Ratios**: Polar-night background (`#0c1826`) paired with ice text (`#e4edf5`) achieves a contrast ratio $> 11:1$, exceeding WCAG AAA standards.
