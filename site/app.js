(() => {
  "use strict";

  const CONFIG = window.MEETING_APP_CONFIG;
  if (!CONFIG) throw new Error("Missing MEETING_APP_CONFIG");

  const state = {
    participant: null,
    mine: new Set(),
    everyone: {},
    updatedAt: {},
    slots: [],
    dirty: false
  };

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");

  function backendConfigured() {
    return CONFIG.supabaseUrl.startsWith("https://") &&
      !CONFIG.supabaseUrl.includes("PASTE_") &&
      CONFIG.supabasePublishableKey.startsWith("sb_publishable_") &&
      !CONFIG.supabasePublishableKey.includes("PASTE_");
  }

  function dateRange(start, end) {
    const out = [];
    let d = new Date(start + "T12:00:00Z");
    const stop = new Date(end + "T12:00:00Z");
    while (d <= stop) {
      const day = d.getUTCDay();
      if (CONFIG.allowedWeekdays.includes(day)) {
        out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`);
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  function makeSlots() {
    const result = [];
    for (const date of dateRange(CONFIG.startDate, CONFIG.endDate)) {
      for (const time of CONFIG.startTimesDubai) {
        const start = new Date(`${date}T${time}:00+04:00`);
        const end = new Date(start.getTime() + CONFIG.durationMinutes * 60000);
        result.push({ id: start.toISOString(), date, start, end });
      }
    }
    return result;
  }

  function fmtTime(date, zone) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function fmtDate(date, zone) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "long",
      day: "2-digit",
      month: "short"
    }).format(date);
  }

  function fmtSaved(ts) {
    if (!ts) return "Not submitted";
    const d = new Date(ts);
    return `Submitted ${new Intl.DateTimeFormat("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }).format(d)}`;
  }

  function fmtSlot(slot) {
    return {
      dxb: `${fmtTime(slot.start, "Asia/Dubai")}–${fmtTime(slot.end, "Asia/Dubai")} Dubai`,
      eu: `${fmtTime(slot.start, "Europe/Paris")}–${fmtTime(slot.end, "Europe/Paris")} Paris/Brussels`
    };
  }

  async function backendFetch(path, options = {}) {
    const base = CONFIG.supabaseUrl.replace(/\/$/, "");
    const headers = {
      apikey: CONFIG.supabasePublishableKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    const response = await fetch(`${base}/rest/v1/${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`${response.status}: ${message || response.statusText}`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function loadAll() {
    const rows = await backendFetch(
      `${CONFIG.table}?poll_id=eq.${encodeURIComponent(CONFIG.pollId)}&select=participant,slots,updated_at`
    );
    const everyone = {};
    const updatedAt = {};
    CONFIG.participants.forEach((p) => {
      everyone[p.name] = [];
      updatedAt[p.name] = null;
    });
    (rows || []).forEach((row) => {
      if (everyone[row.participant] !== undefined) {
        everyone[row.participant] = Array.isArray(row.slots) ? row.slots : [];
        updatedAt[row.participant] = row.updated_at || null;
      }
    });
    state.everyone = everyone;
    state.updatedAt = updatedAt;
  }

  async function loadMine() {
    await loadAll();
    state.mine = new Set(state.participant ? (state.everyone[state.participant] || []) : []);
    state.dirty = false;
  }

  function availabilityCount(slotId) {
    return CONFIG.participants.reduce((count, p) =>
      count + ((state.everyone[p.name] || []).includes(slotId) ? 1 : 0), 0);
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
    $("saveBtn").disabled = !enabled || !state.dirty;
    $("clearBtn").disabled = !enabled || state.mine.size === 0;
  }

  function renderPeople() {
    const wrap = $("people");
    wrap.innerHTML = "";
    CONFIG.participants.forEach((p) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "person-btn" + (state.participant === p.name ? " active" : "");
      button.innerHTML = `${p.name}<span class="person-sub">${p.label}</span>`;
      button.addEventListener("click", async () => {
        state.participant = p.name;
        $("saveStatus").textContent = "";
        try {
          clearError();
          await loadMine();
          renderAll();
        } catch (error) {
          showError("Could not load shared availability. Please refresh the page and try again.");
        }
      });
      wrap.appendChild(button);
    });
  }

  function renderSubmissionStatus() {
    const wrap = $("submissionStatus");
    wrap.innerHTML = "";
    CONFIG.participants.forEach((p) => {
      const done = Boolean(state.updatedAt[p.name]);
      const chip = document.createElement("span");
      chip.className = "submission-chip" + (done ? " done" : "");
      chip.textContent = `${p.name}: ${fmtSaved(state.updatedAt[p.name])}`;
      wrap.appendChild(chip);
    });
  }

  function renderSlots() {
    const days = $("days");
    days.innerHTML = "";
    const byDate = {};
    state.slots.forEach((slot) => (byDate[slot.date] ||= []).push(slot));

    Object.values(byDate).forEach((slots) => {
      const card = document.createElement("div");
      card.className = "day-card";
      const head = document.createElement("div");
      head.className = "day-head";
      head.textContent = fmtDate(slots[0].start, "Asia/Dubai");
      card.appendChild(head);

      slots.forEach((slot) => {
        const count = availabilityCount(slot.id);
        const mine = state.mine.has(slot.id);
        const enabled = Boolean(state.participant) && backendConfigured();
        const row = document.createElement("label");
        row.className = "slot" + (mine ? " mine" : "") + (count === 4 ? " all" : "") + (!enabled ? " disabled" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = mine;
        checkbox.disabled = !enabled;
        checkbox.setAttribute("aria-label", `${fmtDate(slot.start, "Asia/Dubai")} ${fmtTime(slot.start, "Asia/Dubai")} Dubai`);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.mine.add(slot.id); else state.mine.delete(slot.id);
          state.dirty = true;
          renderSlots();
          updateButtons();
        });

        const times = fmtSlot(slot);
        const text = document.createElement("div");
        text.innerHTML = `<div class="time-main">${times.dxb}</div><div class="time-sub">${times.eu}</div>`;

        const badge = document.createElement("div");
        badge.className = "count" + (count === 4 ? " full" : "");
        badge.textContent = `${count}/4`;

        row.append(checkbox, text, badge);
        card.appendChild(row);
      });
      days.appendChild(card);
    });
  }

  function renderSummary() {
    const target = $("summary");
    target.innerHTML = "";
    const ranked = state.slots
      .map((slot) => ({ slot, count: availabilityCount(slot.id) }))
      .filter((item) => item.count > 0)
      .sort((a,b) => b.count - a.count || a.slot.start - b.slot.start);

    if (!ranked.length) {
      target.innerHTML = '<div class="smallnote">No saved availability yet.</div>';
      return;
    }

    const bestCount = ranked[0].count;
    ranked.filter((item) => item.count === bestCount).slice(0, 6).forEach(({slot, count}) => {
      const times = fmtSlot(slot);
      const available = CONFIG.participants
        .filter((p) => (state.everyone[p.name] || []).includes(slot.id))
        .map((p) => p.name);
      const box = document.createElement("div");
      box.className = "best-slot";
      box.innerHTML = `
        <strong>${count === 4 ? "All 4 available" : `${count}/4 available`}</strong><br>
        ${fmtDate(slot.start, "Asia/Dubai")} · ${times.dxb}<br>
        <span class="smallnote">${times.eu}<br>${available.join(", ")}</span>`;
      target.appendChild(box);
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
    const slots = [...state.mine].sort();
    await backendFetch(`${CONFIG.table}?on_conflict=poll_id,participant`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{
        poll_id: CONFIG.pollId,
        participant: state.participant,
        slots,
        updated_at: new Date().toISOString()
      }])
    });
    await loadMine();
    $("saveStatus").textContent = `${state.participant}'s choices are saved.`;
    renderAll();
  }

  async function refresh() {
    await loadAll();
    if (state.participant && !state.dirty) {
      state.mine = new Set(state.everyone[state.participant] || []);
    }
    renderAll();
    $("saveStatus").textContent = "Latest saved choices loaded.";
  }

  async function clearMine() {
    state.mine.clear();
    state.dirty = true;
    await saveMine();
  }

  async function init() {
    document.title = CONFIG.title;
    state.slots = makeSlots();

    if (!backendConfigured()) {
      showError("This deployment is not connected to the shared database yet. The owner must complete config.js before sharing this link.");
      renderAll();
      return;
    }

    try {
      await loadAll();
      clearError();
    } catch (error) {
      showError("Could not connect to the shared availability database. Please try again later.");
    }
    renderAll();

    $("saveBtn").addEventListener("click", async () => {
      try {
        clearError();
        await saveMine();
      } catch (error) {
        showError("Could not save your choices. Please try again.");
      }
    });

    $("refreshBtn").addEventListener("click", async () => {
      try {
        clearError();
        await refresh();
      } catch (error) {
        showError("Could not refresh shared availability. Please try again.");
      }
    });

    $("clearBtn").addEventListener("click", async () => {
      if (!state.participant) return;
      if (window.confirm(`Clear all saved choices for ${state.participant}?`)) {
        try {
          clearError();
          await clearMine();
        } catch (error) {
          showError("Could not clear your choices. Please try again.");
        }
      }
    });

    window.setInterval(async () => {
      if (state.dirty) return;
      try { await refresh(); } catch (_) { /* quiet background refresh */ }
    }, Math.max(15, CONFIG.refreshSeconds || 30) * 1000);
  }

  init();
})();
