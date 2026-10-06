/*!
 * POLAR-OPS: Integrated Polar Expedition Logistics and Asset Management System
 * Smart India Hackathon 2026 | PS 26062 (MoES / NCPOR) | Team Mind Mates
 *
 * This single file is the complete working prototype. It contains:
 *
 *   1. Simulated command server  seed data, offline sync engine (idempotent, SOS-first,
 *                                timestamp ordering, latest-wins conflict handling),
 *                                alerts engine and the Mission Readiness Score engine
 *   2. Command Dashboard         live map, KPIs, readiness ring with explanations, alerts,
 *                                activity feed, SOS banner + alarm, planning, cargo & QR
 *                                registration and label printing, stock thresholds, people
 *   3. Field app                 glove-friendly phone UI with a local offline queue: scan
 *                                cargo, check in, update stock, share location, hold-to-send SOS
 *
 * The field app talks to the simulated server through serverSync(), which mirrors the
 * real POST /api/sync endpoint of the full-stack version (see full-stack/ in this repo).
 * State is kept in the browser (localStorage) so the demo survives a page refresh.
 */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 1 }));
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
  const nowIso = () => new Date().toISOString();
  const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
  const when = (iso) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? clock(iso) : d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + clock(iso);
  };
  const ago = (iso) => {
    if (!iso) return "never";
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min ago";
    return Math.floor(s / 86400) + " d ago";
  };
  const coord = (lat, lng) => (lat == null ? "unknown" : `${Math.abs(lat).toFixed(3)}°${lat < 0 ? "S" : "N"}, ${Math.abs(lng).toFixed(3)}°${lng < 0 ? "W" : "E"}`);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const stCls = (s) => String(s).replace(/\s/g, "");

  // ================================================================ config (mirrors backend/app/config.py)
  const WEIGHTS = { inventory: 0.2, fuel: 0.2, medical: 0.15, personnel: 0.15, cargo: 0.2, comms: 0.1 };
  const LABELS = { inventory: "Stock", fuel: "Fuel", medical: "Medical", personnel: "Check-ins", cargo: "Cargo", comms: "Comms" };
  const CARGO_SCORE = { Delivered: 1, "In Transit": 0.7, Registered: 0.6, Delayed: 0.2, Missing: 0 };
  const OVERDUE_H = 6, COMMS_H = 6, EXPIRY_D = 14, SHORTAGE = 0.25;
  const CAT = { Fuel: "FUEL", Food: "FOOD", Medical: "MED", Scientific: "SCI", Spares: "SPR", Safety: "SAF" };
  const KEY = "polarops-demo-v1";

  // ================================================================ seed
  function seed() {
    const S = { seq: 100, camps: [], route: [], people: [], cargo: [], inv: [], alerts: [], sos: [], activity: [], devices: {}, processed: {} };
    const id = () => ++S.seq;
    S.expedition = { name: "46th Indian Scientific Expedition to Antarctica", region: "Antarctic", status: "Active" };
    const camp = (name, type, lat, lng) => { const c = { id: id(), name, type, lat, lng }; S.camps.push(c); return c; };
    const ship = camp("Ship at India Bay", "Ship", -69.93, 12.05);
    const maitri = camp("Maitri Station", "Station", -70.7667, 11.7333);
    const a = camp("Field Camp A", "Field Camp", -70.98, 10.55);
    const b = camp("Field Camp B", "Field Camp", -71.32, 12.38);
    const bharati = camp("Bharati Station", "Station", -69.4089, 76.1947);
    S.route = [ship.id, maitri.id, a.id, b.id];
    const ppl = [
      ["Dr. Anjali Rao", "manager", "manager", "Command", "Expedition Leader", maitri, 0.5],
      ["Dr. Vikram Menon", "medic", "responder", "Medical", "Medical Officer", maitri, 0.5],
      ["Arjun Mehta", "arjun", "field", "Glaciology", "Glaciologist", b, 1.2],
      ["Priya Nair", "priya", "field", "Glaciology", "Research Scholar", b, 2.0],
      ["Tenzing Bhutia", "tenzing", "field", "Field Safety", "Mountaineering Guide", b, 1.5],
      ["Sneha Iyer", "sneha", "field", "Geology", "Geologist", a, 2.5],
      ["Aditya Joshi", "aditya", "field", "Geology", "Field Assistant", a, 9.0],
      ["Rohan Kulkarni", "rohan", "field", "Logistics", "Logistics Officer", maitri, 0.8],
      ["Meera Das", "meera", "field", "Atmospheric", "Meteorologist", maitri, 1.0],
      ["Farhan Qureshi", "farhan", "field", "Communications", "Radio Officer", maitri, 3.0],
      ["Karan Singh", "karan", "field", "Logistics", "Cargo Supervisor", ship, 2.2],
      ["Lakshmi Reddy", "lakshmi", "field", "Biology", "Biologist", bharati, 1.8],
    ];
    const off = [[0.004, 0.01], [-0.003, 0.012], [0.006, -0.015], [-0.005, -0.02], [0.008, 0.018], [-0.007, 0.006]];
    ppl.forEach(([name, username, role, team, designation, c, hrs], i) => {
      let [dy, dx] = off[i % off.length];
      let lat = c.lat + dy, lng = c.lng + dx;
      if (username === "aditya") { lat = c.lat - 0.07; lng = c.lng - 0.32; }
      const p = { id: id(), name, username, role, team, designation, camp_id: c.id, status: username === "aditya" ? "In Field" : "At Camp", last_checkin_at: hoursAgo(hrs), lat, lng };
      S.people.push(p);
      if (role === "field") S.devices["field-" + username] = { person_id: p.id, label: `Rugged tablet (${name.split(" ")[0]})`, last_sync_at: hoursAgo(hrs) };
    });
    const stock = [
      [maitri, [["Jet A1 fuel", "Fuel", 6200, "L", 7000, 1500], ["Diesel (generators)", "Fuel", 18500, "L", 20000, 5000], ["Field rations", "Food", 1450, "packs", 1600, 300], ["Trauma & first-aid kits", "Medical", 22, "kits", 24, 6], ["Cold-rated safety gear", "Safety", 58, "sets", 60, 15], ["Generator spares", "Spares", 34, "parts", 40, 8]]],
      [a, [["Jet A1 fuel", "Fuel", 520, "L", 600, 150], ["Field rations", "Food", 180, "packs", 200, 40], ["Trauma & first-aid kits", "Medical", 4, "kits", 4, 1], ["Rock sample kits", "Scientific", 28, "kits", 30, 5]]],
      [b, [["Jet A1 fuel", "Fuel", 362, "L", 450, 350], ["Field rations", "Food", 118, "packs", 200, 40], ["Trauma & first-aid kits", "Medical", 4, "kits", 4, 1], ["Ice core sample tubes", "Scientific", 44, "tubes", 60, 10]]],
      [bharati, [["Jet A1 fuel", "Fuel", 5400, "L", 6000, 1500], ["Field rations", "Food", 1100, "packs", 1200, 250], ["Antibiotic stock", "Medical", 38, "courses", 40, 10, 10], ["Cold-rated safety gear", "Safety", 40, "sets", 40, 10]]],
    ];
    stock.forEach(([c, items]) => items.forEach(([name, category, qty, unit, target, threshold, expDays]) => {
      S.inv.push({ id: id(), camp_id: c.id, name, category, qty, unit, target, threshold, expiry: expDays ? new Date(Date.now() + expDays * 864e5).toISOString().slice(0, 10) : null });
    }));
    const cargo = [
      ["Jet A1 drum", "Fuel", 200, "L", "Delivered", maitri, maitri], ["Jet A1 drum", "Fuel", 200, "L", "Delivered", a, a], ["Diesel drum", "Fuel", 200, "L", "In Transit", ship, maitri],
      ["Medical supply crate", "Medical", 2, "kits", "Delivered", maitri, maitri], ["Field ration crate", "Food", 60, "packs", "Registered", maitri, b], ["Field ration crate", "Food", 60, "packs", "Delivered", a, a],
      ["Automatic weather station", "Scientific", 1, "units", "Delivered", maitri, maitri], ["Ice-penetrating radar", "Scientific", 1, "units", "Delivered", b, b], ["GNSS survey receivers", "Scientific", 4, "units", "Delivered", a, a],
      ["Ice core drill spares", "Scientific", 1, "crate", "Delayed", ship, b], ["Snow scooter spares", "Spares", 1, "crate", "Delivered", maitri, maitri], ["Generator spares", "Spares", 6, "parts", "Delivered", maitri, maitri],
      ["Satellite modem (spare)", "Spares", 1, "units", "Missing", ship, b], ["Solar panel array", "Spares", 1, "crate", "In Transit", ship, bharati], ["Crevasse rescue kit", "Safety", 2, "sets", "Delivered", b, b],
      ["Polar tents", "Safety", 4, "units", "Delivered", a, a], ["Cold-weather clothing", "Safety", 20, "sets", "Delivered", maitri, maitri], ["Medical supply crate", "Medical", 2, "kits", "In Transit", ship, bharati],
      ["Lab consumables", "Scientific", 1, "crate", "Delivered", bharati, bharati], ["Sea-ice sampling kit", "Scientific", 1, "crate", "Registered", ship, bharati], ["Field ration crate", "Food", 60, "packs", "Delivered", maitri, maitri],
      ["Emergency beacons", "Safety", 6, "units", "Delivered", maitri, maitri], ["Jet A1 drum", "Fuel", 200, "L", "In Transit", ship, bharati], ["Radio repeater spares", "Spares", 1, "crate", "Registered", maitri, a],
      ["Oxygen cylinders", "Medical", 4, "units", "Delivered", bharati, bharati],
    ];
    cargo.forEach(([name, category, quantity, unit, status, cur, dest], i) => {
      const n = i + 1;
      S.cargo.push({ id: id(), qr: `NCPOR-${CAT[category]}-${String(n).padStart(3, "0")}`, name, category, quantity, unit, status, camp_id: cur.id, dest_id: dest.id, state_ts: hoursAgo(30 - n), updated_at: hoursAgo(30 - n), added: status === "Delivered" });
    });
    [[26, "cargo", "Karan Singh marked NCPOR-SCI-010 Delayed at Ship at India Bay"], [9, "people", "Aditya Joshi checked out of Field Camp A for the moraine traverse"],
      [5, "cargo", "Rohan Kulkarni marked NCPOR-FOOD-021 Delivered at Maitri Station"], [3, "stock", "Priya Nair used 38 L of Jet A1 fuel at Field Camp B"], [1.2, "people", "Arjun Mehta checked in at Field Camp B"]]
      .forEach(([h, kind, text]) => S.activity.push({ id: id(), kind, text, offline: false, created_at: hoursAgo(h) }));
    S.activity.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
    srv = S;
    evaluateAll();
    return S;
  }

  // ================================================================ simulated server
  let srv = null;
  const nid = () => ++srv.seq;
  const campOf = (id) => srv.camps.find((c) => c.id === id);
  const personOf = (id) => srv.people.find((p) => p.id === id);
  const crewList = () => srv.people.filter((p) => p.role === "field");
  const inSos = () => new Set(srv.sos.filter((s) => s.status !== "Resolved").map((s) => s.person_id));
  const isOverdue = (p) => p.role === "field" && (!p.last_checkin_at || Date.now() - new Date(p.last_checkin_at).getTime() > OVERDUE_H * 3600e3);
  function log(kind, text, offline) {
    srv.activity.unshift({ id: nid(), kind, text, offline: !!offline, created_at: nowIso() });
    srv.activity = srv.activity.slice(0, 80);
  }

  function raise(ref, type, severity, message, events) {
    if (srv.alerts.some((a) => a.ref === ref && !a.resolved)) return;
    srv.alerts.unshift({ id: nid(), ref, type, severity, message, resolved: false, created_at: nowIso() });
    log("alert", message);
    if (events) events.push({ type: "alert", message });
  }
  function clear(ref) {
    const a = srv.alerts.find((x) => x.ref === ref && !x.resolved);
    if (a) a.resolved = true;
  }
  function evaluateItem(i, events) {
    const c = campOf(i.camp_id);
    if (i.qty < i.threshold) {
      const sev = ["Fuel", "Medical"].includes(i.category) || i.qty < i.threshold / 2 ? "High" : "Medium";
      raise("low:" + i.id, "Low stock", sev, `${i.name} at ${c.name} is ${num(i.qty)} ${i.unit}, below the ${num(i.threshold)} ${i.unit} threshold`, events);
    } else clear("low:" + i.id);
  }
  function evaluateAll(events) {
    srv.inv.forEach((i) => {
      evaluateItem(i, events);
      if (i.expiry) {
        const days = Math.ceil((new Date(i.expiry) - Date.now()) / 864e5);
        if (days <= EXPIRY_D) raise("exp:" + i.id, "Expiry", "Medium", `${i.name} at ${campOf(i.camp_id).name} ${days < 0 ? "has expired" : `expires in ${days} day${days === 1 ? "" : "s"}`}`, events);
        else clear("exp:" + i.id);
      }
    });
    crewList().forEach((p) => {
      if (isOverdue(p)) raise("od:" + p.id, "Overdue check-in", "High", `${p.name} (${p.team}) has not checked in for ${Math.floor((Date.now() - new Date(p.last_checkin_at)) / 3600e3)} h`, events);
      else clear("od:" + p.id);
    });
    srv.cargo.forEach((a) => {
      if (a.status === "Delayed" || a.status === "Missing") raise("cg:" + a.id, "Cargo", a.status === "Missing" ? "High" : "Medium", `${a.qr} ${a.name} is ${a.status.toLowerCase()}`, events);
      else clear("cg:" + a.id);
    });
  }

  function readiness() {
    const ratio = (i) => {
      const r = Math.max(0, Math.min(1, i.qty / (i.target || 1)));
      return i.qty < i.threshold ? r * SHORTAGE : r;
    };
    const drivers = {}, notes = [];
    const stockDriver = (key, list, weakest) => {
      if (!list.length) return (drivers[key] = [1, "Nothing tracked yet"]);
      let s = list.reduce((t, i) => t + ratio(i), 0) / list.length;
      if (weakest) s = 0.5 * s + 0.5 * Math.min(...list.map(ratio));
      const w = list.reduce((m, i) => (ratio(i) < ratio(m) ? i : m), list[0]);
      const cn = campOf(w.camp_id).name;
      const detail = w.qty < w.threshold ? `${cn}: ${w.name} ${num(w.qty)} ${w.unit}, below its ${num(w.threshold)} ${w.unit} alert level` : `${cn}: ${w.name} at ${Math.round(Math.min(1, w.qty / w.target) * 100)}% of target`;
      drivers[key] = [s, detail];
      if (ratio(w) < 0.85) notes.push([1 - ratio(w), detail]);
    };
    stockDriver("fuel", srv.inv.filter((i) => i.category === "Fuel"), true);
    stockDriver("medical", srv.inv.filter((i) => i.category === "Medical"), true);
    stockDriver("inventory", srv.inv.filter((i) => !["Fuel", "Medical"].includes(i.category)), false);
    const crew = crewList(), sosSet = inSos();
    if (crew.length) {
      const od = crew.filter((p) => isOverdue(p) && !sosSet.has(p.id)), em = crew.filter((p) => sosSet.has(p.id));
      const parts = [];
      if (em.length) parts.push(`${em.length} crew in an open emergency (${em.map((p) => p.name).slice(0, 2).join(", ")})`);
      if (od.length) parts.push(`${od.length} crew overdue on check-in (${od.map((p) => p.name).slice(0, 3).join(", ")})`);
      drivers.personnel = [1 - (od.length + em.length) / crew.length, parts.join("; ") || `All ${crew.length} crew checked in within ${OVERDUE_H} h`];
      if (parts.length) notes.push([(od.length + 2 * em.length) / crew.length + 0.2, parts.join("; ")]);
    } else drivers.personnel = [1, "No field crew yet"];
    if (srv.cargo.length) {
      const bad = srv.cargo.filter((a) => a.status === "Delayed" || a.status === "Missing");
      const s = srv.cargo.reduce((t, a) => t + (CARGO_SCORE[a.status] ?? 0.5), 0) / srv.cargo.length;
      const detail = bad.length ? `${bad.length} cargo item${bad.length === 1 ? "" : "s"} delayed or missing (${bad[0].qr})` : `${srv.cargo.filter((a) => a.status === "Delivered").length} of ${srv.cargo.length} delivered`;
      drivers.cargo = [s, detail];
      if (bad.length) notes.push([bad.length / srv.cargo.length + 0.1, detail]);
    } else drivers.cargo = [1, "No cargo yet"];
    const devs = Object.values(srv.devices);
    if (devs.length) {
      const all = new Set(devs.map((d) => d.person_id));
      const fresh = new Set(devs.filter((d) => d.last_sync_at && Date.now() - new Date(d.last_sync_at) < COMMS_H * 3600e3).map((d) => d.person_id));
      const stale = all.size - fresh.size;
      const detail = stale ? `${stale} crew member${stale === 1 ? "" : "s"} out of contact for over ${COMMS_H} h` : `All ${all.size} field devices synced recently`;
      drivers.comms = [fresh.size / all.size, detail];
      if (stale) notes.push([stale / all.size, detail]);
    } else drivers.comms = [1, "No devices yet"];
    const total = Object.keys(WEIGHTS).reduce((t, k) => t + WEIGHTS[k] * drivers[k][0], 0);
    notes.sort((x, y) => y[0] - x[0]);
    return {
      score: Math.round(total * 100),
      drivers: Object.keys(WEIGHTS).map((k) => ({ key: k, label: LABELS[k], weight: WEIGHTS[k], score: Math.round(drivers[k][0] * 100), detail: drivers[k][1] })),
      why: notes.slice(0, 3).map((n) => n[1]),
    };
  }

  function addDelivery(a, camp) {
    let it = srv.inv.find((i) => i.camp_id === camp.id && i.category === a.category && i.unit === a.unit);
    if (!it) { it = { id: nid(), camp_id: camp.id, category: a.category, name: a.name, qty: 0, unit: a.unit, target: a.quantity, threshold: Math.round(a.quantity * 0.2) }; srv.inv.push(it); }
    it.qty += a.quantity;
    a.added = true;
    return it;
  }

  function applyAction(act, actor, deviceId, events) {
    const p = act.payload || {}, ts = act.client_ts, offline = !!act.offline, tag = offline;
    if (act.type === "cargo_scan") {
      const a = srv.cargo.find((x) => x.qr === String(p.qr || "").toUpperCase());
      if (!a) return "error: unknown QR code";
      const to = p.camp_id ? campOf(p.camp_id) : null;
      if (a.state_ts && ts < a.state_ts) {
        log("conflict", `Older scan of ${a.qr} by ${actor.name} logged; newer status kept`, offline);
        return "superseded";
      }
      a.status = p.status; a.state_ts = ts; a.updated_at = nowIso();
      if (to && p.status === "Delivered") a.camp_id = to.id;
      let text = `${actor.name} marked ${a.qr} ${p.status}${to ? " at " + to.name : ""}`;
      if (p.status === "Delivered" && to && !a.added) {
        const it = addDelivery(a, to);
        text += `; ${num(a.quantity)} ${a.unit} added to ${to.name} stock`;
        evaluateItem(it, events);
      }
      log("cargo", text, tag);
      return "applied";
    }
    if (act.type === "stock_update") {
      const it = srv.inv.find((i) => i.id === p.inventory_id);
      if (!it) return "error: unknown stock line";
      it.qty = Math.max(0, Math.round((it.qty + p.delta) * 100) / 100);
      log("stock", `${actor.name} ${p.delta < 0 ? "used" : "added"} ${num(Math.abs(p.delta))} ${it.unit} of ${it.name} at ${campOf(it.camp_id).name}`, tag);
      evaluateItem(it, events);
      return "applied";
    }
    if (act.type === "checkin" || act.type === "location") {
      const c = p.camp_id ? campOf(p.camp_id) : null;
      if (p.lat != null) { actor.lat = p.lat; actor.lng = p.lng; }
      if (act.type === "checkin") {
        if (!actor.last_checkin_at || ts >= actor.last_checkin_at) {
          actor.last_checkin_at = ts;
          if (c) actor.camp_id = c.id;
          actor.status = p.kind === "out" ? "In Field" : "At Camp";
        }
        log("people", `${actor.name} checked ${p.kind === "out" ? "out" : "in"}${c ? " at " + c.name : ""}`, tag);
      } else log("people", `${actor.name} shared location (${coord(p.lat, p.lng)})`, tag);
      return "applied";
    }
    if (act.type === "sos") {
      const s = { id: nid(), person_id: actor.id, team: actor.team, lat: p.lat ?? actor.lat, lng: p.lng ?? actor.lng, severity: p.severity || "High", status: "Active", client_ts: ts, received_at: nowIso(), offline };
      srv.sos.unshift(s);
      if (s.lat != null) { actor.lat = s.lat; actor.lng = s.lng; }
      const text = `SOS from ${actor.name} (${actor.team}), severity ${s.severity}`;
      log("sos", text, tag);
      raise("sos:" + s.id, "SOS", "Critical", text);
      events.push({ type: "sos", id: s.id, message: text });
      return "applied";
    }
    return "error: unknown action";
  }

  // POST /api/sync
  function serverSync(actions, deviceId, personId) {
    const actor = personOf(personId), events = [], results = {};
    const sorted = [...actions].sort((x, y) => (x.type === "sos" ? 0 : 1) - (y.type === "sos" ? 0 : 1) || (x.client_ts < y.client_ts ? -1 : 1));
    sorted.forEach((a) => {
      if (srv.processed[a.client_id]) { results[a.client_id] = "duplicate"; return; }
      let r;
      try { r = applyAction(a, actor, deviceId, events); } catch (e) { r = "error: " + e.message; }
      srv.processed[a.client_id] = r;
      results[a.client_id] = r;
    });
    srv.devices[deviceId] = { person_id: personId, label: `Field device (${actor.name.split(" ")[0]})`, last_sync_at: nowIso() };
    evaluateAll(events);
    persist();
    dashUpdate(events);
    return results;
  }

  function bootstrapFor(personId) {
    return clone({ me: personOf(personId), camps: srv.camps, cargo: srv.cargo, inv: srv.inv, sos: srv.sos.filter((s) => s.person_id === personId).slice(0, 3) });
  }

  // ================================================================ persistence
  let fld = null; // field device state
  function freshField() { return { user: null, boot: null, queue: [], offline: false, everOffline: false, lastSync: null }; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ srv, fld, tour: [...tourDone] })); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.srv && d.srv.camps) { srv = d.srv; fld = d.fld || freshField(); (d.tour || []).forEach((t) => tourDone.add(t)); return; }
      }
    } catch (e) { /* ignore */ }
    seed();
    fld = freshField();
  }

  // ================================================================ guided tour
  const TOUR = [
    ["signin", "Sign in on the phone"],
    ["transit", "Scan NCPOR-FOOD-005, mark in transit"],
    ["offline", "Switch the phone to No signal"],
    ["deliver", "Record delivery at Field Camp B"],
    ["fuel", "Log 15 L of Jet A1 used at Camp B"],
    ["sync", "Restore signal and watch it sync"],
    ["sos", "Hold SOS for 2 seconds"],
    ["ack", "Acknowledge the SOS"],
  ];
  const tourDone = new Set();
  function tick(id) {
    if (tourDone.has(id)) return;
    tourDone.add(id);
    renderTour();
    persist();
  }
  function renderTour() {
    const next = TOUR.find(([id]) => !tourDone.has(id));
    $("#tour-steps").innerHTML = TOUR.map(([id, t], i) => `<li class="${tourDone.has(id) ? "done" : next && next[0] === id ? "next" : ""}">${i + 1}. ${esc(t)}</li>`).join("");
    const cur = $("#tour-steps .next");
    if (cur) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // ================================================================ dashboard
  let actingAs = "manager";
  let tab = "command";
  let lastScore = null, scoreChange = null, lastActId = 0, muted = false, mapFocus = "route", cargoFilter = "all", pendingFocusSos = null;

  function toast(msg, kind = "") {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
  let audio = null;
  const unlockAudio = () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) { /* none */ } };
  document.addEventListener("pointerdown", unlockAudio);
  function beep() {
    if (!audio || muted) return;
    const t = audio.currentTime;
    [0, 0.22].forEach((o) => {
      const osc = audio.createOscillator(), g = audio.createGain();
      osc.type = "square"; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.12, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.16);
      osc.connect(g).connect(audio.destination); osc.start(t + o); osc.stop(t + o + 0.18);
    });
  }
  setInterval(() => { if (srv && srv.sos.some((s) => s.status === "Active")) beep(); }, 1400);

  function dashUpdate(events) {
    (events || []).forEach((e) => {
      if (e.type === "sos") { toast(e.message, "err"); beep(); pendingFocusSos = e.id; }
      else if (e.type === "alert") toast(e.message);
    });
    renderDash();
  }

  function renderDash() {
    renderKpis(); renderReadiness(); renderAlerts(); renderActivity(); renderCamps(); renderMap(); renderSos();
    if (tab === "cargo") renderCargo();
    if (tab === "stock") renderStock();
    if (tab === "people") renderPeople();
    if (tab === "plan") renderPlan();
  }

  function renderKpis() {
    const crew = crewList(), od = crew.filter(isOverdue).length, c = srv.cargo;
    const by = (s) => c.filter((a) => a.status === s).length;
    const pct = (n) => (c.length ? (n / c.length) * 100 : 0);
    const bad = by("Delayed") + by("Missing"), active = srv.sos.filter((s) => s.status === "Active").length;
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="v">${srv.people.length}</div><div class="l">Personnel on expedition</div></div>
      <div class="kpi ${od ? "warn" : ""}"><div class="v">${od}</div><div class="l">Overdue check-ins (${OVERDUE_H} h+)</div></div>
      <div class="kpi"><div class="v">${by("Delivered")}<span style="font-size:14px;color:var(--frost)"> / ${c.length}</span></div><div class="l">Cargo delivered</div>
        <div class="bar"><i style="width:${pct(by("Delivered"))}%;background:var(--ok)"></i><i style="width:${pct(by("In Transit"))}%;background:var(--transit)"></i><i style="width:${pct(by("Registered"))}%;background:var(--frost)"></i><i style="width:${pct(bad)}%;background:var(--sos)"></i></div></div>
      <div class="kpi"><div class="v" style="color:var(--transit)">${by("In Transit")}</div><div class="l">Cargo in transit</div></div>
      <div class="kpi ${bad ? "warn" : ""}"><div class="v">${bad}</div><div class="l">Delayed or missing</div></div>
      <div class="kpi ${active ? "bad" : ""}"><div class="v">${active}</div><div class="l">Active SOS</div></div>`;
  }

  function renderReadiness() {
    const r = readiness();
    if (lastScore !== null && r.score !== lastScore) scoreChange = { d: r.score - lastScore, from: lastScore, at: nowIso() };
    lastScore = r.score;
    const C = 2 * Math.PI * 52;
    const color = r.score >= 85 ? "var(--signal)" : r.score >= 70 ? "var(--warn)" : "var(--sos)";
    const el = $("#readiness");
    if (!el.querySelector(".fill")) {
      el.innerHTML = `<div class="ring-row"><div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52" fill="none" stroke-width="12"/><circle class="fill" cx="60" cy="60" r="52" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
        <div class="val"><div><b id="score">0%</b><small>mission ready</small></div></div></div>
        <div><h2>Mission Readiness</h2><p class="hint" style="margin:3px 0 0">Stock, fuel, medical, check-ins, cargo and comms in one number.</p><div id="delta"></div></div></div>
        <ul class="drivers" id="drivers"></ul><div class="why" id="why"></div>`;
    }
    requestAnimationFrame(() => { const f = el.querySelector(".fill"); f.style.strokeDashoffset = C * (1 - r.score / 100); f.style.stroke = color; });
    $("#score").textContent = r.score + "%";
    $("#delta").innerHTML = scoreChange ? `<div class="delta ${scoreChange.d < 0 ? "down" : "up"}">${scoreChange.d < 0 ? "Down" : "Up"} ${Math.abs(scoreChange.d)} point${Math.abs(scoreChange.d) === 1 ? "" : "s"} at ${clock(scoreChange.at)} (was ${scoreChange.from}%)</div>` : `<div class="hint" style="margin-top:4px">Recalculated on every update</div>`;
    $("#drivers").innerHTML = r.drivers.map((d) => `<li class="${d.score < 85 ? "low" : ""}" title="${esc(d.detail)} · weight ${Math.round(d.weight * 100)}%"><span>${d.label}</span><span class="tr"><i style="width:${d.score}%"></i></span><b>${d.score}%</b></li>`).join("");
    $("#why").innerHTML = r.why.length ? `<p>What is pulling the score down</p><ul>${r.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : `<p style="margin:0">Every driver is at or near target.</p>`;
  }

  function renderAlerts() {
    const open = srv.alerts.filter((a) => !a.resolved);
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    open.sort((a, b) => order[a.severity] - order[b.severity]);
    $("#alert-count").textContent = open.length || "";
    $("#alerts").innerHTML = open.map((a) => `<li class="${a.severity}"><div>${esc(a.message)}<div class="t">${esc(a.type)} · ${ago(a.created_at)}</div></div>${a.type !== "SOS" && actingAs === "manager" ? `<button class="x" data-clr="${a.id}">Clear</button>` : "<span></span>"}</li>`).join("") || `<li class="empty" style="display:block;padding:8px 12px">No open alerts.</li>`;
    $$("[data-clr]").forEach((b) => (b.onclick = () => {
      const a = srv.alerts.find((x) => x.id === +b.dataset.clr);
      a.resolved = true;
      log("alert", `${actorName()} cleared alert: ${a.message}`);
      persist(); renderDash();
    }));
  }

  function renderActivity() {
    const max = srv.activity.length ? srv.activity[0].id : 0;
    $("#activity").innerHTML = srv.activity.slice(0, 40).map((a) => `<li class="${a.kind} ${a.id > lastActId && lastActId ? "fresh" : ""}"><span class="when">${when(a.created_at)}</span><span class="what">${esc(a.text)} ${a.offline ? '<span class="off-badge">offline-synced</span>' : ""}</span></li>`).join("");
    lastActId = Math.max(lastActId, max) || max;
  }

  function renderCamps() {
    $("#camp-cards").innerHTML = srv.camps.map((c) => {
      const ppl = srv.people.filter((p) => p.camp_id === c.id).length;
      const items = srv.inv.filter((i) => i.camp_id === c.id);
      const low = items.filter((i) => i.qty < i.threshold).length;
      const inbound = srv.cargo.filter((a) => a.dest_id === c.id && a.status !== "Delivered").length;
      return `<div class="camp-card"><h3>${esc(c.name)}</h3><div class="meta">${esc(c.type)} · ${ppl} people</div>
        ${items.filter((i) => i.category === "Fuel").map((f) => `<div class="line"><span>${esc(f.name)}</span><span class="${f.qty < f.threshold ? "low" : ""}">${num(f.qty)} ${f.unit}</span></div>`).join("")}
        <div class="line"><span>Inbound cargo</span><span>${inbound}</span></div>${low ? `<div class="line low"><span>Low stock</span><span>${low}</span></div>` : ""}</div>`;
    }).join("");
  }

  // ---------- SVG map
  const MW = 820, MH = 520;
  function projector(points) {
    const lats = points.map((p) => p[0]), lngs = points.map((p) => p[1]);
    let minLa = Math.min(...lats), maxLa = Math.max(...lats), minLo = Math.min(...lngs), maxLo = Math.max(...lngs);
    const midLa = (minLa + maxLa) / 2, cos = Math.cos((midLa * Math.PI) / 180);
    let spanLa = Math.max(maxLa - minLa, 0.5), spanLo = Math.max(maxLo - minLo, 0.5 / cos);
    spanLa *= 1.35; spanLo *= 1.35;
    const cLa = (minLa + maxLa) / 2, cLo = (minLo + maxLo) / 2;
    const k = Math.min(MW / (spanLo * cos), MH / spanLa);
    const fwd = (lat, lng) => [MW / 2 + (lng - cLo) * cos * k, MH / 2 - (lat - cLa) * k];
    const inv = (x, y) => [cLa - (y - MH / 2) / k, cLo + (x - MW / 2) / (cos * k)];
    return { fwd, inv, k, cos, cLa, cLo };
  }
  function graticule(P) {
    const [laTop, loL] = P.inv(0, 0), [laBot, loR] = P.inv(MW, MH);
    const span = laTop - laBot;
    const step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20].find((s) => span / s <= 8) || 20;
    const lstep = [0.25, 0.5, 1, 2, 5, 10, 20, 30].find((s) => (loR - loL) / s <= 10) || 30;
    let out = '<g class="grid">';
    for (let la = Math.ceil(laBot / step) * step; la <= laTop; la += step) { const y = P.fwd(la, P.cLo)[1]; out += `<line x1="0" x2="${MW}" y1="${y}" y2="${y}"/><text x="4" y="${y - 3}">${Math.abs(la).toFixed(step < 1 ? 2 : 0)}°${la < 0 ? "S" : "N"}</text>`; }
    for (let lo = Math.ceil(loL / lstep) * lstep; lo <= loR; lo += lstep) { const x = P.fwd(P.cLa, lo)[0]; out += `<line y1="0" y2="${MH}" x1="${x}" x2="${x}"/><text x="${x + 3}" y="${MH - 5}">${Math.abs(lo).toFixed(lstep < 1 ? 2 : 0)}°${lo < 0 ? "W" : "E"}</text>`; }
    return out + "</g>";
  }
  function mapSvg(focusCamps, opts = {}) {
    const pts = focusCamps.length ? focusCamps.map((c) => [c.lat, c.lng]) : [[-70.8, 11.7]];
    const P = projector(pts);
    let s = graticule(P);
    const route = srv.route.map(campOf).filter(Boolean);
    if (route.length > 1) s += `<polyline class="route" points="${route.map((c) => P.fwd(c.lat, c.lng).join(",")).join(" ")}"/>`;
    srv.camps.forEach((c) => {
      const [x, y] = P.fwd(c.lat, c.lng);
      if (x < -50 || x > MW + 50 || y < -50 || y > MH + 50) return;
      const ppl = srv.people.filter((p) => p.camp_id === c.id).length;
      s += `<g class="camp ${c.type === "Station" ? "station" : ""}"><title>${esc(c.name)} · ${esc(c.type)} · ${ppl} people</title><rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3" transform="rotate(45 ${x} ${y})"/><text x="${x + 16}" y="${y - 10}">${esc(c.name)}</text></g>`;
    });
    if (!opts.plan) {
      const ringCount = {};
      srv.people.forEach((p) => {
        if (p.lat == null) return;
        let [x, y] = P.fwd(p.lat, p.lng);
        const od = isOverdue(p), home = campOf(p.camp_id);
        if (home) {
          const [cx, cy] = P.fwd(home.lat, home.lng);
          if (Math.hypot(x - cx, y - cy) < 16) { // crew at camp: fan out around the camp marker
            const k = (ringCount[home.id] = (ringCount[home.id] || 0) + 1);
            const ang = -Math.PI / 2 + k * 0.75;
            x = cx + Math.cos(ang) * 17; y = cy + Math.sin(ang) * 17;
          }
        }
        s += `<g><title>${esc(p.name)} · ${esc(p.team)} · last check-in ${ago(p.last_checkin_at)}${od ? " · OVERDUE" : ""}</title>${od ? `<circle class="halo warn" cx="${x}" cy="${y}" r="6"/>` : ""}<circle class="crew ${od ? "overdue" : ""}" cx="${x}" cy="${y}" r="5.5"/></g>`;
      });
      srv.sos.filter((x) => x.status !== "Resolved" && x.lat != null).forEach((so) => {
        const [x, y] = P.fwd(so.lat, so.lng);
        s += `<g><title>SOS · ${esc(personOf(so.person_id).name)}</title><circle class="halo sos" cx="${x}" cy="${y}" r="9"/><circle class="sos-dot" cx="${x}" cy="${y}" r="8"/></g>`;
      });
    }
    return { svg: s, P };
  }
  function focusCamps() {
    const r = srv.route.map(campOf).filter(Boolean);
    return mapFocus === "route" && r.length ? r : srv.camps;
  }
  function renderMap() {
    let camps = focusCamps();
    if (pendingFocusSos) {
      const so = srv.sos.find((x) => x.id === pendingFocusSos);
      pendingFocusSos = null;
      if (so && so.lat != null && !camps.some((c) => Math.abs(c.lat - so.lat) < 1.5 && Math.abs(c.lng - so.lng) < 3)) camps = [...camps, { lat: so.lat, lng: so.lng }];
    }
    $("#map").innerHTML = mapSvg(camps).svg;
  }

  function renderSos() {
    const open = srv.sos.filter((s) => s.status !== "Resolved");
    const el = $("#sos-banner");
    if (!open.length) { el.hidden = true; return; }
    const s = open.find((x) => x.status === "Active") || open[0];
    const p = personOf(s.person_id);
    el.hidden = false;
    el.className = "sos-banner " + (s.status === "Acknowledged" ? "ack" : "");
    el.innerHTML = `<div class="sos-mark">SOS</div><div><h2>${s.status === "Active" ? "Emergency" : "Emergency acknowledged"}: ${esc(p.name)}, ${esc(p.designation)} (${esc(p.team)})</h2>
      <div class="facts"><span>Severity <b>${esc(s.severity)}</b></span><span>Raised <b>${clock(s.client_ts)}</b></span><span>Location <b>${coord(s.lat, s.lng)}</b></span>${s.offline ? "<span><b>Sent while offline</b></span>" : ""}${s.ack_by ? `<span>Acknowledged by <b>${esc(s.ack_by)}</b></span>` : ""}</div></div>
      <div class="acts">${s.status === "Active" ? `<button class="btn" data-sa="ack">Acknowledge</button>` : ""}<button class="btn ${s.status === "Active" ? "ghost" : ""}" data-sa="resolve">Resolve</button></div>`;
    $$("[data-sa]", el).forEach((b) => (b.onclick = () => {
      if (b.dataset.sa === "ack") { s.status = "Acknowledged"; s.ack_by = actorName(); log("sos", `${actorName()} acknowledged SOS from ${p.name}`); tick("ack"); toast("SOS acknowledged. The field device will show it on next sync.", "ok"); }
      else { s.status = "Resolved"; s.ack_by = s.ack_by || actorName(); clear("sos:" + s.id); log("sos", `${actorName()} resolved SOS from ${p.name}`); tick("ack"); toast("SOS resolved", "ok"); }
      persist(); renderDash(); fieldRefreshIfOnline();
    }));
  }
  const actorName = () => (actingAs === "manager" ? "Dr. Anjali Rao" : "Dr. Vikram Menon");

  // ---------- cargo
  function qrSvg(text, cell = 2) {
    try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell, margin: 1, scalable: true }); } catch (e) { return ""; }
  }
  function renderCargo() {
    const list = srv.cargo.filter((a) => cargoFilter === "all" || a.status === cargoFilter);
    $("#cargo-table").innerHTML = `<thead><tr><th>Tag</th><th>QR id</th><th>Item</th><th>Qty</th><th>Status</th><th>Now at</th><th>Destination</th><th>Updated</th></tr></thead><tbody>` +
      (list.map((a) => `<tr><td><span class="qr">${qrSvg(a.qr)}</span></td><td class="code">${esc(a.qr)}</td><td>${esc(a.name)}<div class="hint">${esc(a.category)}</div></td><td>${num(a.quantity)} ${esc(a.unit)}</td>
        <td><span class="st ${stCls(a.status)}">${esc(a.status)}</span></td><td>${esc((campOf(a.camp_id) || {}).name || "–")}</td><td>${esc((campOf(a.dest_id) || {}).name || "–")}</td><td>${ago(a.updated_at)}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No cargo with this status.</td></tr>`) + "</tbody>";
  }
  function printLabels() {
    const list = srv.cargo.filter((a) => cargoFilter === "all" || a.status === cargoFilter);
    $("#print-sheet").innerHTML = list.map((a) => `<div class="label"><div class="qrp">${qrSvg(a.qr, 3)}</div><div><b>${esc(a.qr)}</b><div>${esc(a.name)}</div><div>${esc(a.category)} · ${num(a.quantity)} ${esc(a.unit)}${a.dest_id ? " · to " + esc(campOf(a.dest_id).name) : ""}</div><div style="font-size:9px;margin-top:2mm">NCPOR · POLAR-OPS</div></div></div>`).join("");
    try { window.print(); } catch (e) { toast("Printing is blocked here. Use your browser's Print command.", "err"); }
  }

  // ---------- stock
  function renderStock() {
    const wrap = $("#stock-grid");
    if (wrap.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    wrap.innerHTML = srv.camps.map((c) => {
      const items = srv.inv.filter((i) => i.camp_id === c.id);
      return `<div class="panel"><div class="panel-head"><h2>${esc(c.name)}</h2><span class="hint">${items.filter((i) => i.qty < i.threshold).length} below threshold</span></div>${items.map((i) => {
        const pct = Math.min(100, (i.qty / i.target) * 100), thr = Math.min(100, (i.threshold / i.target) * 100), low = i.qty < i.threshold;
        return `<div class="srow"><div><b>${esc(i.name)}</b><div class="sub">${esc(i.category)} · target ${num(i.target)} ${esc(i.unit)}${i.expiry ? " · expires " + esc(i.expiry) : ""}</div></div>
          <div><div class="gauge ${low ? "low" : pct < 50 ? "mid" : ""}"><i style="width:${pct}%"></i><span class="thr" style="left:${thr}%"></span></div><div class="sub"><span class="${low ? "lowq" : ""}">${num(i.qty)}</span> ${esc(i.unit)} on hand</div></div>
          <label>Alert below<input type="number" step="any" value="${i.threshold}" data-thr="${i.id}" ${actingAs !== "manager" ? "disabled" : ""}></label></div>`;
      }).join("") || '<p class="empty">No stock tracked.</p>'}</div>`;
    }).join("");
    $$("[data-thr]").forEach((inp) => (inp.onchange = () => {
      const i = srv.inv.find((x) => x.id === +inp.dataset.thr);
      i.threshold = +inp.value;
      const ev = [];
      evaluateItem(i, ev);
      persist(); inp.blur(); dashUpdate(ev); renderStock(); toast("Threshold updated", "ok");
    }));
  }

  // ---------- people
  function renderPeople() {
    $("#people-table").innerHTML = `<thead><tr><th>Name</th><th>Team</th><th>Role</th><th>Camp</th><th>Status</th><th>Last check-in</th><th>Location</th></tr></thead><tbody>` +
      srv.people.map((p) => `<tr><td><b>${esc(p.name)}</b><div class="hint">${esc(p.designation || "")}</div></td><td>${esc(p.team)}</td><td>${{ field: "Field crew", manager: "Manager", responder: "Responder" }[p.role]}</td><td>${esc((campOf(p.camp_id) || {}).name || "–")}</td>
        <td>${isOverdue(p) ? '<span class="st Overdue">Overdue</span>' : esc(p.status)}</td><td>${ago(p.last_checkin_at)}</td><td>${coord(p.lat, p.lng)}</td></tr>`).join("") + "</tbody>";
    $("#device-table").innerHTML = `<thead><tr><th>Device</th><th>Assigned to</th><th>Last sync</th><th>Contact</th></tr></thead><tbody>` +
      Object.entries(srv.devices).map(([id, d]) => {
        const fresh = d.last_sync_at && Date.now() - new Date(d.last_sync_at) < COMMS_H * 3600e3;
        return `<tr><td>${esc(d.label || id)}</td><td>${esc((personOf(d.person_id) || {}).name || "–")}</td><td>${ago(d.last_sync_at)}</td><td><span class="st ${fresh ? "ok" : "warn"}">${fresh ? "In contact" : "Out of contact"}</span></td></tr>`;
      }).join("") + "</tbody>";
    $("#sos-table").innerHTML = `<thead><tr><th>Raised</th><th>Person</th><th>Severity</th><th>Status</th><th>Handled by</th><th></th></tr></thead><tbody>` +
      (srv.sos.map((s) => `<tr><td>${when(s.client_ts)}</td><td>${esc(personOf(s.person_id).name)}</td><td>${esc(s.severity)}</td><td><span class="st ${s.status}">${s.status}</span></td><td>${esc(s.ack_by || "–")}</td><td>${s.offline ? '<span class="off-badge">offline-synced</span>' : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">No SOS raised yet.</td></tr>`) + "</tbody>";
  }

  // ---------- planning
  let planP = null, draft = null;
  function renderPlan() {
    const pts = srv.route.map(campOf).filter(Boolean);
    const { svg, P } = mapSvg(pts.length ? pts : srv.camps, { plan: true });
    planP = P;
    $("#plan-map").innerHTML = svg;
    if (!draft || draft.n !== srv.camps.length) {
      draft = { n: srv.camps.length, order: [...srv.route, ...srv.camps.map((c) => c.id).filter((id) => !srv.route.includes(id))], on: new Set(srv.route) };
    }
    $("#route-list").innerHTML = draft.order.map((id, i) => {
      const c = campOf(id);
      return `<li class="${draft.on.has(id) ? "" : "off"}"><span class="g"><b>${esc(c.name)}</b><br><span class="hint">${esc(c.type)}</span></span><button data-mv="${i}" data-d="-1" aria-label="Move up">↑</button><button data-mv="${i}" data-d="1" aria-label="Move down">↓</button><button data-tg="${id}">${draft.on.has(id) ? "Skip" : "Include"}</button></li>`;
    }).join("");
    $$("[data-mv]").forEach((b) => (b.onclick = () => {
      const i = +b.dataset.mv, j = i + +b.dataset.d;
      if (j < 0 || j >= draft.order.length) return;
      [draft.order[i], draft.order[j]] = [draft.order[j], draft.order[i]];
      renderPlan();
    }));
    $$("[data-tg]").forEach((b) => (b.onclick = () => { const id = +b.dataset.tg; draft.on.has(id) ? draft.on.delete(id) : draft.on.add(id); renderPlan(); }));
    $("#person-camp").innerHTML = srv.camps.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  }

  function fillCampSelects() {
    $$(".camp-sel").forEach((s) => {
      const v = s.value;
      s.innerHTML = srv.camps.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      if (v) s.value = v;
    });
  }

  function showTab(name) {
    tab = name;
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + name));
    fillCampSelects();
    renderDash();
  }

  function bindDash() {
    $$(".tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
    $$("#map-focus button").forEach((b) => (b.onclick = () => { mapFocus = b.dataset.f; $$("#map-focus button").forEach((x) => x.classList.toggle("on", x === b)); renderMap(); }));
    $$("#cargo-filter button").forEach((b) => (b.onclick = () => { cargoFilter = b.dataset.f; $$("#cargo-filter button").forEach((x) => x.classList.toggle("on", x === b)); renderCargo(); }));
    $("#print").onclick = printLabels;
    $("#mute").onclick = () => { muted = !muted; $("#mute").textContent = muted ? "Alarm muted" : "Alarm on"; };
    $("#acting").onchange = (e) => {
      actingAs = e.target.value;
      $$("[data-mgr]").forEach((b) => (b.hidden = actingAs !== "manager"));
      if (actingAs !== "manager" && ["plan", "cargo", "stock"].includes(tab)) showTab("command");
      toast(actingAs === "manager" ? "Signed in as Dr. Anjali Rao, Expedition Leader" : "Signed in as Dr. Vikram Menon, Medical Officer (responder: SOS and people only)", "ok");
      renderDash();
    };
    $("#reset").onclick = () => {
      if (!confirm("Reset everything to the starting demo data?")) return;
      tourDone.clear();
      seed(); fld = freshField();
      lastScore = null; scoreChange = null; lastActId = 0; draft = null;
      persist(); renderTour(); renderDash(); fieldGo("login"); renderNet();
      toast("Demo data restored", "ok");
    };
    $("#cargo-form").onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const count = Math.max(1, Math.min(50, +f.count || 1));
      let max = srv.cargo.reduce((m, a) => Math.max(m, +a.qr.split("-").pop()), 0);
      const made = [];
      for (let i = 0; i < count; i++) {
        const a = { id: nid(), qr: `NCPOR-${CAT[f.category]}-${String(++max).padStart(3, "0")}`, name: f.name.trim(), category: f.category, quantity: +f.quantity || 1, unit: f.unit || "units", status: "Registered", camp_id: +f.camp_id, dest_id: +f.dest_id, state_ts: nowIso(), updated_at: nowIso(), added: false };
        srv.cargo.push(a); made.push(a);
      }
      log("cargo", `${actorName()} registered ${count} × ${f.name} (${made[0].qr}${count > 1 ? " to " + made[count - 1].qr : ""})`);
      persist(); renderDash(); renderCargo();
      toast(count > 1 ? `Registered ${count} items, ${made[0].qr} to ${made[count - 1].qr}` : `Registered ${made[0].qr}`, "ok");
      e.target.reset(); fillCampSelects();
    };
    $("#plan-map").onclick = (e) => {
      const svg = $("#plan-map"), r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MW, y = ((e.clientY - r.top) / r.height) * MH;
      const [lat, lng] = planP.inv(x, y);
      const pop = $("#camp-pop");
      pop.hidden = false;
      pop.style.left = Math.min(e.clientX - svg.parentElement.getBoundingClientRect().left, r.width - 240) + "px";
      pop.style.top = e.clientY - svg.parentElement.getBoundingClientRect().top + 10 + "px";
      pop.dataset.lat = lat; pop.dataset.lng = lng;
      $("#pop-coord").textContent = coord(lat, lng);
      $("#pop-name").value = "";
      $("#pop-name").focus();
    };
    $("#pop-cancel").onclick = () => ($("#camp-pop").hidden = true);
    $("#pop-form").onsubmit = (e) => {
      e.preventDefault();
      const pop = $("#camp-pop"), name = $("#pop-name").value.trim();
      if (!name) return;
      const c = { id: nid(), name, type: $("#pop-type").value, lat: +pop.dataset.lat, lng: +pop.dataset.lng };
      srv.camps.push(c); srv.route.push(c.id);
      log("plan", `${actorName()} added ${c.type.toLowerCase()} ${c.name} to the route`);
      pop.hidden = true; draft = null;
      persist(); renderDash(); fillCampSelects();
      toast(`Added ${name} to the route`, "ok");
    };
    $("#save-route").onclick = () => {
      srv.route = draft.order.filter((id) => draft.on.has(id));
      log("plan", `${actorName()} updated the route (${srv.route.length} stops)`);
      draft = null; persist(); renderDash(); toast("Route saved", "ok");
    };
    $("#person-form").onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const base = (f.name.toLowerCase().replace("dr.", "").trim().split(/\s+/)[0] || "crew").replace(/[^a-z]/g, "") || "crew";
      let u = base, n = 1;
      while (srv.people.some((p) => p.username === u)) u = base + ++n;
      const c = campOf(+f.camp_id);
      srv.people.push({ id: nid(), name: f.name.trim(), username: u, role: f.role, team: f.team || "Logistics", designation: f.designation || (f.role === "field" ? "Field crew" : ""), camp_id: c.id, status: "At Camp", last_checkin_at: nowIso(), lat: c.lat + 0.004, lng: c.lng - 0.01 });
      log("people", `${actorName()} added ${f.name} (${f.team || "Logistics"}) to ${c.name}`);
      persist(); renderDash();
      toast(`Added ${f.name}. They can now sign in on the phone.`, "ok");
      e.target.querySelector("[name=name]").value = "";
      if (fld.user == null) renderFieldLogin();
    };
  }

  // ================================================================ field app (phone)
  let fscreen = "login", ftoastT, asset = null, chosenCamp = null, stockCamp = null, stockItem = null, amt = 0, mode = -1, sev = "High", holdT = null;
  const me = () => fld.boot && fld.boot.me;
  const fcamp = (id) => fld.boot && fld.boot.camps.find((c) => c.id === id);
  const fOnline = () => !fld.offline;

  function ftoast(msg, kind = "") {
    const t = $("#ftoast");
    t.textContent = msg; t.className = "ftoast " + kind; t.hidden = false;
    clearTimeout(ftoastT); ftoastT = setTimeout(() => (t.hidden = true), 3000);
  }
  function renderNet() {
    const bar = $("#netbar");
    bar.hidden = !fld.user;
    bar.classList.toggle("offline", fld.offline);
    $("#net-label").textContent = fld.offline ? "Offline: no signal" : syncing ? "Syncing" : "Online";
    $("#sig").textContent = fld.offline ? "Restore signal" : "Lose signal";
    const p = $("#pending");
    p.textContent = fld.queue.length ? `${fld.queue.length} pending` : "All synced";
    p.classList.toggle("has", fld.queue.length > 0);
    bar.classList.toggle("syncing", syncing);
  }
  function applyLocal(a) {
    const b = fld.boot, p = a.payload;
    if (a.type === "cargo_scan") {
      const c = b.cargo.find((x) => x.qr === p.qr);
      if (!c) return;
      const was = c.status === "Delivered";
      c.status = p.status;
      if (p.status === "Delivered" && p.camp_id) {
        c.camp_id = p.camp_id;
        if (!was) { const it = b.inv.find((i) => i.camp_id === p.camp_id && i.category === c.category && i.unit === c.unit); if (it) it.qty += c.quantity; }
      }
    } else if (a.type === "stock_update") {
      const it = b.inv.find((i) => i.id === p.inventory_id);
      if (it) it.qty = Math.max(0, Math.round((it.qty + p.delta) * 100) / 100);
    } else if (a.type === "checkin") {
      if (p.kind === "in" && p.camp_id) b.me.camp_id = p.camp_id;
      b.me.last_checkin_at = a.client_ts;
    } else if (a.type === "sos") {
      b.sos.unshift({ id: "local", severity: p.severity, status: "Queued", client_ts: a.client_ts });
    }
  }
  function enqueue(type, payload) {
    const a = { client_id: uuid(), type, payload, client_ts: nowIso(), offline: fld.offline };
    fld.queue.push(a);
    applyLocal(a);
    persist(); renderNet();
    try { navigator.vibrate && navigator.vibrate(40); } catch (e) { /* none */ }
    if (fOnline()) flush();
    return a;
  }
  let syncing = false;
  function flush() {
    if (syncing || !fld.queue.length || fld.offline) return;
    syncing = true; renderNet();
    setTimeout(() => {
      if (fld.offline) { syncing = false; renderNet(); return; }
      const batch = fld.queue.slice();
      const hadOffline = batch.some((a) => a.offline);
      const res = serverSync(batch, "tab-" + me().username, fld.user);
      fld.queue = fld.queue.filter((a) => !(a.client_id in res));
      fld.lastSync = nowIso();
      fld.boot = bootstrapFor(fld.user);
      fld.queue.forEach(applyLocal);
      syncing = false;
      const errs = Object.values(res).filter((r) => String(r).startsWith("error"));
      if (errs.length) ftoast(errs[0], "bad");
      else if (batch.length > 1 || hadOffline) ftoast(`Synced ${batch.length} update${batch.length > 1 ? "s" : ""} to base`);
      if (hadOffline) tick("sync");
      persist(); renderNet();
      if (!["amount", "sos", "sent"].includes(fscreen)) fieldGo(fscreen);
    }, 450);
  }
  function fieldRefreshIfOnline() {
    if (fld.user && !fld.offline && !fld.queue.length) {
      fld.boot = bootstrapFor(fld.user);
      persist();
      if (fscreen === "home") fieldGo("home");
    }
  }
  function position() {
    const c = fcamp(me().camp_id) || fld.boot.camps[0];
    const j = () => (Math.random() - 0.5) * 0.012;
    return { lat: +(c.lat + j()).toFixed(5), lng: +(c.lng + j() * 2).toFixed(5) };
  }

  const ICON = {
    scan: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM9 10l2 2 4-4"/></svg>',
    stock: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/></svg>',
    loc: '<svg viewBox="0 0 24 24"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 17a5 5 0 1 0 0-10a5 5 0 0 0 0 10"/></svg>',
  };
  const bar = (title, back = "home") => `<div class="fbar"><button class="back" data-fgo="${back}">Back</button><h2>${esc(title)}</h2></div>`;

  function fieldGo(name) {
    fscreen = name;
    const body = $("#fbody");
    body.scrollTop = 0;
    const R = {
      login: renderFieldLogin, home: fHome, scan: fScan, asset: fAsset, checkin: fCheckin, stock: fStock, amount: fAmount, location: fLocation, sos: fSos, sent: () => {}, queue: fQueue,
    };
    (R[name] || fHome)();
    renderNet();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-fgo]"); if (b) fieldGo(b.dataset.fgo); });

  function renderFieldLogin() {
    if (fscreen !== "login") return;
    $("#fbody").innerHTML = `<div><h1>POLAR-OPS Field</h1><p class="fnote">Tap your name to start your shift</p></div>` +
      crewList().map((p) => `<button class="crew" data-login="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.designation)} · ${esc(p.team)} · ${esc((campOf(p.camp_id) || {}).name || "")}</small></button>`).join("");
    $$("[data-login]").forEach((b) => (b.onclick = () => {
      fld.user = +b.dataset.login; fld.queue = []; fld.boot = bootstrapFor(fld.user);
      persist(); tick("signin");
      fieldGo("home");
      ftoast(`Signed in as ${me().name}. You can now work without signal.`);
    }));
  }
  function fHome() {
    const m = me(), c = fcamp(m.camp_id), s = (fld.boot.sos || [])[0];
    let notice = "";
    if (s && s.status !== "Resolved") {
      const map = { Queued: ["bad", "Your SOS is stored and will send the moment any signal returns."], Active: ["bad", "Your SOS reached base. Waiting for the duty manager to acknowledge."], Acknowledged: ["ok", `SOS acknowledged by ${s.ack_by || "base"}. Help is being coordinated.`] };
      const [k, t] = map[s.status] || map.Active;
      notice = `<div class="notice ${k}">${esc(t)}</div>`;
    }
    $("#fbody").innerHTML = `<div><h1>${esc(m.name)}</h1><p class="fnote">${esc(m.team)} · ${esc(c ? c.name : "No camp")} · checked in ${ago(m.last_checkin_at)}</p></div>
      <div class="tiles"><button class="tile" data-fgo="scan">${ICON.scan}<span>Scan cargo</span></button><button class="tile" data-fgo="checkin">${ICON.check}<span>Check in</span></button>
      <button class="tile" data-fgo="stock">${ICON.stock}<span>Update stock</span></button><button class="tile" data-fgo="location">${ICON.loc}<span>Share location</span></button>
      <button class="tile sos" data-fgo="sos"><span class="w">SOS</span><span>Emergency</span></button></div>${notice}
      <button class="big" data-fgo="queue">Device and sync queue</button><button class="big" id="signout" style="background:transparent">Sign out</button>`;
    $("#signout").onclick = () => {
      if (fld.queue.length && !confirm(`${fld.queue.length} update(s) haven't reached base yet. Sign out anyway? They will be lost in this demo.`)) return;
      fld = freshField(); persist(); fieldGo("login");
    };
  }
  function fScan() {
    $("#fbody").innerHTML = `${bar("Scan cargo")}<p class="fnote">On a real device this opens the camera. Type a tag or pick it from the manifest.</p>
      <form class="code-form" id="code-form"><input id="code" placeholder="e.g. NCPOR-FOOD-005" autocomplete="off" aria-label="Cargo tag"><button class="big" type="submit">Find</button></form><div id="picks" class="fbody" style="padding:0;overflow:visible"></div>`;
    const draw = (f) => {
      const q = f.trim().toUpperCase();
      const list = fld.boot.cargo.filter((a) => !q || a.qr.includes(q) || a.name.toUpperCase().includes(q));
      list.sort((a, b) => (a.qr === "NCPOR-FOOD-005" ? -1 : b.qr === "NCPOR-FOOD-005" ? 1 : 0));
      $("#picks").innerHTML = list.map((a) => `<button class="pick" data-qr="${esc(a.qr)}"><b>${esc(a.qr)}</b><small>${esc(a.name)} · ${esc((fcamp(a.camp_id) || {}).name || "")}</small><span class="st ${stCls(a.status)}">${esc(a.status)}</span></button>`).join("") || `<p class="fnote">No cargo matches.</p>`;
      $$("[data-qr]").forEach((b) => (b.onclick = () => openAsset(b.dataset.qr)));
    };
    draw("");
    $("#code").oninput = (e) => draw(e.target.value);
    $("#code-form").onsubmit = (e) => { e.preventDefault(); openAsset($("#code").value); };
  }
  function openAsset(code) {
    const q = String(code || "").trim().toUpperCase();
    asset = fld.boot.cargo.find((a) => a.qr === q);
    if (!asset) return ftoast(q ? `No cargo tagged ${q}` : "Enter a tag first", "bad");
    fieldGo("asset");
  }
  function fAsset() {
    const a = fld.boot.cargo.find((x) => x.qr === asset.qr), here = fcamp(me().camp_id), dest = fcamp(a.dest_id);
    const at = [here, dest].filter(Boolean).filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    $("#fbody").innerHTML = `${bar("Cargo", "scan")}<div class="fcard"><div class="bigcode">${esc(a.qr)}</div><div style="margin-bottom:8px">${esc(a.name)}</div>
      <div class="kv"><span>Status</span><b><span class="st ${stCls(a.status)}">${esc(a.status)}</span></b></div><div class="kv"><span>Quantity</span><b>${num(a.quantity)} ${esc(a.unit)}</b></div>
      <div class="kv"><span>Now at</span><b>${esc((fcamp(a.camp_id) || {}).name || "–")}</b></div><div class="kv"><span>Destination</span><b>${esc(dest ? dest.name : "–")}</b></div></div>
      ${a.status !== "In Transit" && a.status !== "Delivered" ? `<button class="big primary" data-s="In Transit">Mark in transit</button>` : ""}
      ${at.map((c) => `<button class="big ${a.status === "In Transit" ? "primary" : "good"}" data-s="Delivered" data-c="${c.id}">Delivered at ${esc(c.name)}</button>`).join("")}
      <div class="split"><button class="big warn" data-s="Delayed">Report delayed</button><button class="big bad" data-s="Missing">Report missing</button></div>`;
    $$("[data-s]").forEach((b) => (b.onclick = () => {
      const p = { qr: a.qr, status: b.dataset.s };
      if (b.dataset.c) p.camp_id = +b.dataset.c;
      const wasOffline = fld.offline;
      enqueue("cargo_scan", p);
      if (a.qr === "NCPOR-FOOD-005" && p.status === "In Transit") tick("transit");
      if (a.qr === "NCPOR-FOOD-005" && p.status === "Delivered" && wasOffline) tick("deliver");
      ftoast(`${a.qr} marked ${p.status.toLowerCase()}${wasOffline ? ". Stored on device" : ""}`, wasOffline ? "warn" : "");
      fieldGo("scan");
    }));
  }
  function fCheckin() {
    chosenCamp = chosenCamp || me().camp_id;
    $("#fbody").innerHTML = `${bar("Check in")}<p class="fnote">Where are you?</p>${fld.boot.camps.map((c) => `<button class="choice ${c.id === chosenCamp ? "on" : ""}" data-cc="${c.id}">${esc(c.name)}<small>${esc(c.type)}</small></button>`).join("")}
      <div class="split"><button class="big primary" id="cin">Check in</button><button class="big" id="cout">Check out</button></div>`;
    $$("[data-cc]").forEach((b) => (b.onclick = () => { chosenCamp = +b.dataset.cc; fCheckin(); }));
    const go = (kind) => {
      const pos = position(), off = fld.offline;
      enqueue("checkin", { kind, camp_id: chosenCamp, lat: pos.lat, lng: pos.lng });
      ftoast(`Checked ${kind === "in" ? "in at " + fcamp(chosenCamp).name : "out to the field"}${off ? ". Stored on device" : ""}`, off ? "warn" : "");
      fieldGo("home");
    };
    $("#cin").onclick = () => go("in");
    $("#cout").onclick = () => go("out");
  }
  function fStock() {
    stockCamp = stockCamp || me().camp_id;
    const items = fld.boot.inv.filter((i) => i.camp_id === stockCamp);
    $("#fbody").innerHTML = `${bar("Update stock")}<div class="chips">${fld.boot.camps.map((c) => `<button class="${c.id === stockCamp ? "on" : ""}" data-sc="${c.id}">${esc(c.name)}</button>`).join("")}</div>
      ${items.map((i) => `<button class="item-btn ${i.qty < i.threshold ? "low" : ""}" data-it="${i.id}"><b>${esc(i.name)}</b><small>alert below ${num(i.threshold)} ${esc(i.unit)}</small><span class="q">${num(i.qty)} <small>${esc(i.unit)}</small></span></button>`).join("") || '<p class="fnote">No stock tracked here.</p>'}`;
    $$("[data-sc]").forEach((b) => (b.onclick = () => { stockCamp = +b.dataset.sc; fStock(); }));
    $$("[data-it]").forEach((b) => (b.onclick = () => { stockItem = +b.dataset.it; amt = 0; mode = -1; fieldGo("amount"); }));
  }
  function fAmount() {
    const i = fld.boot.inv.find((x) => x.id === stockItem);
    const steps = i.unit === "L" || i.qty > 200 ? [5, 10, 25, 50] : [1, 2, 5, 10];
    $("#fbody").innerHTML = `${bar(i.name, "stock")}<div class="fcard"><div class="kv"><span>On hand</span><b>${num(i.qty)} ${esc(i.unit)}</b></div><div class="kv"><span>After this update</span><b id="after"></b></div></div>
      <div class="chips mode"><button data-m="-1" class="${mode < 0 ? "on" : ""}">Used</button><button data-m="1" class="${mode > 0 ? "on" : ""}">Received</button></div>
      <div class="pad">${steps.map((s) => `<button data-add="${s}">+${s}</button>`).join("")}</div>
      <div class="amt"><button class="big" id="minus" aria-label="Less">−</button><output id="amt">0</output><button class="big" id="plus" aria-label="More">+</button></div>
      <button class="big primary" id="save"></button>`;
    const paint = () => {
      const after = Math.max(0, i.qty + mode * amt), low = after < i.threshold;
      $("#amt").textContent = amt;
      $("#after").textContent = `${num(after)} ${i.unit}${low ? " · below threshold" : ""}`;
      $("#after").style.color = low ? "var(--sos)" : "";
      $("#save").disabled = amt <= 0;
      $("#save").textContent = amt > 0 ? `Save: ${mode < 0 ? "used" : "received"} ${amt} ${i.unit}` : "Choose an amount";
    };
    $$("[data-m]").forEach((b) => (b.onclick = () => { mode = +b.dataset.m; $$("[data-m]").forEach((x) => x.classList.toggle("on", x === b)); paint(); }));
    $$("[data-add]").forEach((b) => (b.onclick = () => { amt += +b.dataset.add; paint(); }));
    $("#plus").onclick = () => { amt++; paint(); };
    $("#minus").onclick = () => { amt = Math.max(0, amt - 1); paint(); };
    $("#save").onclick = () => {
      if (amt <= 0) return;
      const off = fld.offline;
      enqueue("stock_update", { inventory_id: i.id, delta: mode * amt });
      const camp = fcamp(i.camp_id);
      if (off && i.category === "Fuel" && camp && camp.name === "Field Camp B" && mode < 0) tick("fuel");
      const now = fld.boot.inv.find((x) => x.id === i.id);
      ftoast(`${i.name} now ${num(now.qty)} ${now.unit}${off ? ". Stored on device" : ""}`, now.qty < now.threshold ? "bad" : off ? "warn" : "");
      fieldGo("stock");
    };
    paint();
  }
  function fLocation() {
    const pos = position();
    $("#fbody").innerHTML = `${bar("Share location")}<div class="fcard"><div class="kv"><span>Position</span><b>${coord(pos.lat, pos.lng)}</b></div><div class="kv"><span>Source</span><b>Near ${esc((fcamp(me().camp_id) || {}).name || "camp")}</b></div></div>
      <p class="fnote">In the real app this uses GPS. Here the position is placed near your assigned camp.</p><button class="big primary" id="share">Share my location</button>`;
    $("#share").onclick = () => {
      const off = fld.offline;
      enqueue("location", pos);
      ftoast(off ? "Location stored. Shares when signal returns" : "Location shared with base", off ? "warn" : "");
      fieldGo("home");
    };
  }
  function fSos() {
    $("#fbody").innerHTML = `${bar("Emergency SOS")}<p class="fnote">How serious is it?</p>
      <div class="sev">${["Low", "Medium", "High", "Critical"].map((s) => `<button data-sev="${s}" class="${s === sev ? "on" : ""}">${s}</button>`).join("")}</div>
      <button class="hold" id="hold" aria-label="Hold for 2 seconds to send SOS"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" class="trk"/><circle cx="100" cy="100" r="92" class="fil"/></svg><span class="ht"><b>SOS</b><small>Hold 2 seconds</small></span></button>
      <p class="fnote" style="text-align:center">Sends your name, team, location, time and severity. Without signal it is stored and goes first when any link returns.</p>`;
    $$("[data-sev]").forEach((b) => (b.onclick = () => { sev = b.dataset.sev; $$("[data-sev]").forEach((x) => x.classList.toggle("on", x === b)); }));
    const h = $("#hold");
    const start = (e) => { e.preventDefault(); h.classList.add("holding"); holdT = setTimeout(send, 2000); };
    const stop = () => { clearTimeout(holdT); holdT = null; h.classList.remove("holding"); };
    h.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => h.addEventListener(ev, stop));
    h.addEventListener("contextmenu", (e) => e.preventDefault());
    h.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !holdT) start(e); });
    h.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") stop(); });
  }
  function send() {
    holdT = null;
    const pos = position(), off = fld.offline;
    pos.lat = +(pos.lat - 0.02).toFixed(5); pos.lng = +(pos.lng + 0.05).toFixed(5);
    try { navigator.vibrate && navigator.vibrate([200, 80, 200, 80, 400]); } catch (e) { /* none */ }
    unlockAudio();
    enqueue("sos", { severity: sev, lat: pos.lat, lng: pos.lng });
    tick("sos");
    fscreen = "sent";
    $("#fbody").innerHTML = `<div class="sent"><div class="m">SOS</div><h2>${off ? "SOS stored on device" : "SOS sent to base"}</h2>
      <p class="fnote">${off ? `No signal right now. Your SOS is first in the queue and sends the instant a link returns. Position recorded: ${coord(pos.lat, pos.lng)}.` : `The duty manager now has your name, team, position (${coord(pos.lat, pos.lng)}), time and severity (${esc(sev)}).`}</p>
      <button class="big" data-fgo="home">Back to home</button></div>`;
  }
  function fQueue() {
    const L = {
      cargo_scan: (a) => `${a.payload.qr}: ${a.payload.status}`,
      stock_update: (a) => { const i = fld.boot.inv.find((x) => x.id === a.payload.inventory_id) || {}; return `${a.payload.delta < 0 ? "Used" : "Received"} ${Math.abs(a.payload.delta)} ${i.unit || ""} ${i.name || ""}`; },
      checkin: (a) => `Checked ${a.payload.kind}`, location: () => "Location shared", sos: (a) => `SOS (${a.payload.severity})`,
    };
    $("#fbody").innerHTML = `${bar("Device")}<div class="fcard"><div class="kv"><span>Device</span><b>tab-${esc(me().username)}</b></div><div class="kv"><span>Signal</span><b>${fld.offline ? "None" : "Connected"}</b></div><div class="kv"><span>Last sync</span><b>${ago(fld.lastSync)}</b></div></div>
      <h2 style="font-size:16px">Stored on this device, waiting to sync</h2><ul class="qlist">${fld.queue.map((a) => `<li class="${a.type === "sos" ? "s" : ""}"><span>${esc(L[a.type](a))}</span><small>${clock(a.client_ts)}</small></li>`).join("") || "<li><span>Nothing waiting. Base has every update.</span></li>"}</ul>`;
  }

  function bindField() {
    const toggle = () => {
      fld.offline = !fld.offline;
      if (fld.offline) { fld.everOffline = true; tick("offline"); ftoast("No signal. Everything is now stored on the device", "warn"); }
      else { ftoast("Signal back. Syncing"); flush(); fieldRefreshIfOnline(); }
      persist(); renderNet();
      if (fscreen === "queue") fQueue();
    };
    $("#sig").onclick = toggle;
    $("#net-state").onclick = () => fld.user && fieldGo("queue");
    $$(".switch button").forEach((b) => (b.onclick = () => {
      $$(".switch button").forEach((x) => x.classList.toggle("on", x === b));
      $("#stage").className = "stage " + b.dataset.show;
      window.scrollTo(0, 0);
    }));
  }

  // ================================================================ start
  load();
  bindDash();
  bindField();
  fillCampSelects();
  renderTour();
  renderDash();
  if (fld.user && fld.boot && personOf(fld.user)) fieldGo("home"); else { fld = freshField(); fieldGo("login"); }
  if (fld.queue.length && !fld.offline) flush();
  setInterval(() => { const ev = []; evaluateAll(ev); if (ev.length) { persist(); dashUpdate(ev); } else { renderKpis(); renderActivity(); } }, 20000);
})();
