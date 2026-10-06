# Frontend Architectural Decision Records (ADRs)

**Project:** POLAR-OPS (Smart India Hackathon 2026 · PS 26062)  
**Status:** Accepted & Implemented  

---

## ADR 01: Zero-Dependency Pure Vanilla ES6+ Architecture

* **Context:** The application will be evaluated by hackathon judges across unpredictable environments, corporate firewalls, and diverse browsers. Real-world field tablets in Antarctica also face restricted software installation policies.
* **Decision:** Build the entire client without React, Vue, Next.js, or npm build tooling. Use modern ES6+ JavaScript wrapped in a clean modular IIFE.
* **Consequences:**
  * **Positive:** Zero `node_modules` baggage; double-clicking `index.html` runs immediately in any browser; instant GitHub Pages deployment with zero build failures.
  * **Trade-off:** UI rendering requires manual template string management rather than JSX/VDOM diffing.

---

## ADR 02: Mathematical Vector SVG Antarctic Polar Projection

* **Context:** Remote polar research bases have no high-speed satellite internet to fetch dynamic map tiles from OpenStreetMap or Mapbox.
* **Decision:** Implement a native mathematical Antarctic polar coordinate projector in pure SVG that translates latitude/longitude into planar Cartesian coordinates, generating Antarctic graticule lines and station markers on the fly.
* **Consequences:**
  * **Positive:** Completely offline; zero map API tokens or network calls; resolution-independent vector clarity; micro-animations on crew beacon halos run smoothly at 60fps.
  * **Trade-off:** Lacks detailed topographic satellite terrain overlays (sufficient for operational overview).

---

## ADR 03: Native Web Audio API Sound Synthesizer for Emergency Sirens

* **Context:** Remote emergency alarms must trigger immediately upon an SOS beacon without relying on streaming or downloading external `.mp3` or `.wav` media files.
* **Decision:** Utilize the browser's native `AudioContext` to synthesize an 880Hz square-wave oscillating siren dynamically with exponential gain ramps.
* **Consequences:**
  * **Positive:** Instantaneous acoustic feedback with 0KB asset download; runs autonomously offline; zero audio asset caching bugs.
  * **Trade-off:** Requires an initial user gesture (`pointerdown`) to unlock the browser's audio security sandbox.

---

## ADR 04: Dual-Screen Side-by-Side Presentation Architecture

* **Context:** Evaluators need to test how actions taken on a field tablet (e.g. marking cargo delivered offline) immediately propagate to the central command dashboard. Demonstrating this with two separate devices during a 3-minute pitch introduces network connectivity risk.
* **Decision:** Implement a dual-column split view on desktop screens featuring the Command Dashboard on the left and a 1:1 simulated Rugged Tablet on the right, linked through a shared in-memory sync engine.
* **Consequences:**
  * **Positive:** Judges see the cause-and-effect relationship in real time with zero friction; ideal for presentations and automated walkthroughs.
  * **Trade-off:** Requires responsive CSS switching (`show-dash` / `show-field`) for smaller laptop and mobile viewports.

---

## ADR 05: Offline-First FIFO LocalStorage Transaction Queuing

* **Context:** Arctic blizzards cause prolonged satellite communication blackouts. Operatives cannot be blocked from logging critical fuel or medical supply movements.
* **Decision:** Persist all mutations to an internal FIFO queue (`fld.queue`) stored in `localStorage` under key `polarops-demo-v1`. Every action is assigned a UUID `client_id` for idempotent deduplication upon reconnection.
* **Consequences:**
  * **Positive:** 100% resilient against accidental page refreshes or device reboots; guaranteed zero double-counting when network flushes.
  * **Trade-off:** Storage is bound to the local browser domain.
