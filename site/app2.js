(() => {
  "use strict";

  const CONFIG = window.MEETING_APP_CONFIG;
  const state = { participant: null, mine: new Set(), everyone: {}, updatedAt: {}, slots: [], dirty: false };
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");

  const backendConfigured = () => CONFIG && typeof CONFIG.apiUrl === "string" && CONFIG.apiUrl.startsWith("https://");

  function dateRange(start, end) {
    const out = [];
    let d = new Date(start + "T12:00:00Z");
    const stop = new Date(end + "T12:00:00Z");
    while (d <= stop) {
      if (CONFIG.allowedWeekdays.includes(d.getUTCDay())) {
        out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`);
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  function makeSlots() {
    const out = [];
    for (const date of dateRange(CONFIG.startDate, CONFIG.endDate)) {
      for (const time of CONFIG.startTimesDubai) {
        const start = new Date(`${date}T${time}:00+04:00`);
        const end = new Date(start.getTime() + CONFIG.durationMinutes * 60000);
        out.push({ id: start.toISOString(), date, start, end });
      }
    }
    return out;
  }

  function visibleSlotIds() {
    return new Set(state.slots.map(s => s.id));
  }

  function currentSlotsFor(name) {
    const visible = visibleSlotIds();
    return (state.everyone[name] || []).filter(id => visible.has(id));
  }

  function archivedSlotsFor(name) {
    const visible = visibleSlotIds();
    return (state.everyone[name] || []).filter(id => !visible.has(id));
  }

  function fmtTime(date, zone) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function fmtDate(date, zone) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "2-digit", month: "short" }).format(date);
  }

  function fmtSaved(ts) {
    if (!ts) return "Not submitted";
    const d = new Date(ts);
    return new Intl.DateTimeFormat("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }).format(d);
  }

  function fmtSlot(slot) {
    return {
      dxb: `${fmtTime(slot.start, "Asia/Dubai")}–${fmtTime(slot.end, "Asia/Dubai")} Dubai`,
      eu: `${fmtTime(slot.start, "Europe/Paris")}–${fmtTime(slot.end, "Europe/Paris")} Paris/Brussels`
    };
  }

  async function api(method = "GET", payload = null) {
    const response = await fetch(CONFIG.apiUrl, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store"
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = data && typeof data === "object" && data.error ? data.error : (text || response.statusText);
      throw new Error(message);
    }
    return data;
  }

  async function loadAll() {
    const rows = await api("GET");
    const everyone = {}, updatedAt = {};
    CONFIG.participants.forEach(p => { everyone[p.name] = []; updatedAt[p.name] = null; });
    (rows || []).forEach(row => {
      if (Object.prototype.hasOwnProperty.call(everyone, row.participant)) {
        everyone[row.participant] = Array.isArray(row.slots) ? row.slots : [];
        updatedAt[row.participant] = row.updated_at || null;
      }
    });
    state.everyone = everyone;
    state.updatedAt = updatedAt;
  }

  async function loadMine() {
    await loadAll();
    state.mine = new Set(state.participant ? currentSlotsFor(state.participant) : []);
    state.dirty = false;
  }

  function count(slotId) {
    return CONFIG.participants.reduce((n,p) => n + ((state.everyone[p.name] || []).includes(slotId) ? 1 : 0), 0);
  }

  function showError(message) {
    const el = $("systemMessage");
    el.hidden = false;
    el.className = "system-message error";
    el.textContent = message;
  }

  function clearError() {
    const el = $("systemMessage");
    el.hidden = true;
    el.textContent = "";
  }

  function updateButtons() {
    const enabled = Boolean(state.participant) && backendConfigured();
    $("saveBtn").disabled = !enabled || !state.dirty || state.mine.size === 0;
    $("clearBtn").disabled = !enabled || state.mine.size === 0;
  }

  function renderPeople() {
    const wrap = $("people");
    wrap.innerHTML = "";
    CONFIG.participants.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "person-btn" + (state.participant === p.name ? " active" : "");
      b.innerHTML = `${p.name}<span class="person-sub">${p.label}</span>`;
      b.onclick = async () => {
        state.participant = p.name;
        $("saveStatus").textContent = "";
        try {
          clearError();
          await loadMine();
          renderAll();
        } catch {
          showError("Could not load shared availability. Please refresh the page and try again.");
        }
      };
      wrap.appendChild(b);
    });
  }

  function renderSubmissionStatus() {
    const wrap = $("submissionStatus");
    wrap.innerHTML = "";
    CONFIG.participants.forEach(p => {
      const currentCount = currentSlotsFor(p.name).length;
      const archivedCount = archivedSlotsFor(p.name).length;
      const ts = state.updatedAt[p.name];
      const chip = document.createElement("span");
      chip.className = "submission-chip" + (currentCount > 0 ? " done" : "");
      if (currentCount > 0) {
        const retained = archivedCount > 0 ? ` · ${archivedCount} previous retained` : "";
        chip.textContent = `${p.name}: Saved ${currentCount} slot${currentCount === 1 ? "" : "s"} · ${fmtSaved(ts)}${retained}`;
      } else if (archivedCount > 0) {
        chip.textContent = `${p.name}: Not submitted for current dates · ${archivedCount} previous slot${archivedCount === 1 ? "" : "s"} retained`;
      } else if (ts) {
        chip.textContent = `${p.name}: No slots saved · last action ${fmtSaved(ts)}`;
      } else {
        chip.textContent = `${p.name}: Not submitted`;
      }
      wrap.appendChild(chip);
    });
  }

  function renderSlots() {
    const days = $("days");
    days.innerHTML = "";
    const grouped = {};
    state.slots.forEach(s => (grouped[s.date] ||= []).push(s));
    Object.values(grouped).forEach(slots => {
      const card = document.createElement("div");
      card.className = "day-card";
      const head = document.createElement("div");
      head.className = "day-head";
      head.textContent = fmtDate(slots[0].start, "Asia/Dubai");
      card.appendChild(head);

      slots.forEach(slot => {
        const c = count(slot.id);
        const mine = state.mine.has(slot.id);
        const enabled = Boolean(state.participant) && backendConfigured();
        const row = document.createElement("label");
        row.className = "slot" + (mine ? " mine" : "") + (c === 4 ? " all" : "") + (!enabled ? " disabled" : "");

        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = mine;
        box.disabled = !enabled;
        box.onchange = () => {
          box.checked ? state.mine.add(slot.id) : state.mine.delete(slot.id);
          state.dirty = true;
          $("saveStatus").textContent = state.mine.size > 0
            ? `${state.mine.size} slot${state.mine.size === 1 ? "" : "s"} selected for the current dates — click Save my choices.`
            : "No slots selected for the current dates.";
          renderSlots();
          updateButtons();
        };

        const times = fmtSlot(slot);
        const txt = document.createElement("div");
        txt.innerHTML = `<div class="time-main">${times.dxb}</div><div class="time-sub">${times.eu}</div>`;
        const badge = document.createElement("div");
        badge.className = "count" + (c === 4 ? " full" : "");
        badge.textContent = `${c}/4`;
        row.append(box, txt, badge);
        card.appendChild(row);
      });
      days.appendChild(card);
    });
  }

  function renderSummary() {
    const target = $("summary");
    target.innerHTML = "";
    const ranked = state.slots
      .map(slot => ({slot, c: count(slot.id)}))
      .filter(x => x.c > 0)
      .sort((a,b) => b.c-a.c || a.slot.start-b.slot.start);

    if (!ranked.length) {
      target.innerHTML = '<div class="smallnote">No saved availability yet for these dates.</div>';
      return;
    }

    const best = ranked[0].c;
    ranked.filter(x => x.c === best).slice(0,6).forEach(({slot,c}) => {
      const times = fmtSlot(slot);
      const names = CONFIG.participants.filter(p => (state.everyone[p.name] || []).includes(slot.id)).map(p => p.name);
      const div = document.createElement("div");
      div.className = "best-slot";
      div.innerHTML = `<strong>${c===4 ? "All 4 available" : `${c}/4 available`}</strong><br>${fmtDate(slot.start,"Asia/Dubai")} · ${times.dxb}<br><span class="smallnote">${times.eu}<br>${names.join(", ")}</span>`;
      target.appendChild(div);
    });
  }

  function renderAll() {
    renderPeople();
    renderSubmissionStatus();
    renderSummary();
    renderSlots();
    updateButtons();
  }

  async function saveMine() {
    const current = [...state.mine].sort();
    if (!current.length) throw new Error("Choose at least one time slot before saving.");

    const archived = archivedSlotsFor(state.participant);
    const intended = [...new Set([...archived, ...current])].sort();
    const result = await api("POST", { participant: state.participant, slots: intended });
    const saved = result && result.saved && Array.isArray(result.saved.slots) ? [...result.saved.slots].sort() : null;
    if (!saved || JSON.stringify(saved) !== JSON.stringify(intended)) {
      throw new Error("The server did not confirm all selected time slots. Please try again.");
    }

    await loadMine();
    $("saveStatus").textContent = `${state.participant}: ${current.length} current slot${current.length === 1 ? "" : "s"} saved successfully. Previous records were retained.`;
    renderAll();
  }

  async function clearMine() {
    const archived = archivedSlotsFor(state.participant).sort();
    const payload = archived.length
      ? { participant: state.participant, slots: archived }
      : { participant: state.participant, slots: [], clear: true };
    const result = await api("POST", payload);
    const saved = result && result.saved && Array.isArray(result.saved.slots) ? [...result.saved.slots].sort() : [];
    if (JSON.stringify(saved) !== JSON.stringify(archived)) {
      throw new Error("The server did not confirm the update. Please try again.");
    }
    await loadMine();
    $("saveStatus").textContent = `${state.participant}'s choices for the current dates were cleared. Previous records were retained.`;
    renderAll();
  }

  async function refresh() {
    await loadAll();
    if (state.participant && !state.dirty) state.mine = new Set(currentSlotsFor(state.participant));
    renderAll();
    $("saveStatus").textContent = "Latest saved choices loaded.";
  }

  async function init() {
    document.title = CONFIG.title;
    state.slots = makeSlots();
    if (!backendConfigured()) {
      showError("This deployment is not connected to the shared database yet.");
      renderAll();
      return;
    }

    try {
      await loadAll();
      clearError();
    } catch {
      showError("Could not connect to the shared availability database. Please try again later.");
    }
    renderAll();

    $("saveBtn").onclick = async () => {
      try {
        clearError();
        await saveMine();
      } catch (e) {
        showError(e?.message || "Could not save your choices. Please try again.");
      }
    };

    $("refreshBtn").onclick = async () => {
      try {
        clearError();
        await refresh();
      } catch {
        showError("Could not refresh shared availability. Please try again.");
      }
    };

    $("clearBtn").onclick = async () => {
      if (!state.participant || !confirm(`Clear saved choices for ${state.participant} for the current dates only? Previous records will be kept.`)) return;
      try {
        clearError();
        await clearMine();
      } catch (e) {
        showError(e?.message || "Could not clear your choices. Please try again.");
      }
    };

    setInterval(async () => {
      if (!state.dirty) {
        try { await refresh(); } catch {}
      }
    }, Math.max(15, CONFIG.refreshSeconds || 30) * 1000);
  }

  init();
})();
