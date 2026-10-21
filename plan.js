// My plan: everything a person saved (care plans, hospital-bill applications, letters), with deadlines,
// calendar reminders and document checklists. Stored only in this browser (localStorage).

var Plan = (function () {
  var KEY = "cn_plan_v1";
  function localDay(d) { d = d || new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("plan")); }
  // item: { kind, title, summary, steps: [], deadlines: [{label, date: "YYYY-MM-DD"}], docs: [labels], links: [{label, url}] }
  function add(item) {
    var items = all();
    var it = Object.assign({ steps: [], deadlines: [], docs: [], links: [], summary: "" }, item, {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), saved: localDay()
    });
    it.docs = (it.docs || []).map(function (d) { return typeof d === "string" ? { label: d, done: false } : d; });
    items.unshift(it); save(items); return it;
  }
  function update(id, fn) { var items = all(); items.forEach(function (x) { if (x.id === id) fn(x); }); save(items); }
  function remove(id) { save(all().filter(function (x) { return x.id !== id; })); }
  function daysUntil(date, today) {
    var a = Date.parse(date + "T12:00:00"), b = Date.parse((today || localDay()) + "T12:00:00");
    return isNaN(a) ? null : Math.round((a - b) / 86400000);
  }
  // One calendar file (.ics) with an all-day event per deadline, and a reminder 3 days before.
  function ics(item) {
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var clean = function (s) { return String(s).replace(/[\\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
    var ev = item.deadlines.filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d.date); }).map(function (d, i) {
      var day = d.date.replace(/-/g, ""), next = new Date(Date.parse(d.date + "T12:00:00") + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
      return ["BEGIN:VEVENT", "UID:" + item.id + "-" + i + "@care-navigator", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + next,
        "SUMMARY:" + clean(d.label), "DESCRIPTION:" + clean(item.title), "BEGIN:VALARM", "TRIGGER:-P3D", "ACTION:DISPLAY", "DESCRIPTION:" + clean(d.label), "END:VALARM", "END:VEVENT"].join("\r\n");
    });
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Care Navigator//EN"].concat(ev, ["END:VCALENDAR"]).join("\r\n");
  }
  return { all: all, add: add, update: update, remove: remove, daysUntil: daysUntil, ics: ics, KEY: KEY };
})();

if (typeof document !== "undefined") (function () {
  var view = document.getElementById("view-plan");
  if (!view) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function badge() {
    var n = Plan.all().length, b = document.getElementById("planCount");
    if (b) { b.textContent = n; b.classList.toggle("hidden", !n); }
  }
  function dueText(d) {
    var n = Plan.daysUntil(d.date);
    if (n === null) return "";
    var cls = n < 0 ? "past" : n <= 14 ? "soon" : "";
    return "<span class='due " + cls + "'>" + (n < 0 ? Math.abs(n) + " days ago" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days") + "</span>";
  }
  function render() {
    badge();
    var items = Plan.all(), tools = view.querySelector(".tab-tools");  // keep the Undo / Clear bar across redraws
    view.innerHTML = "<section class='tool-intro'><h2>My plan</h2><p>Everything you saved, with deadlines and the documents you need. " +
      "<span class='hint'>Saved only in this browser on this device. Nothing is sent anywhere.</span></p></section>" +
      (items.length ? "" : "<div class='card'><p>Nothing saved yet. When you get a plan on the <b>Get help</b>, <b>Hospital bill</b> or <b>Fight a bill</b> tabs, tap <b>Save to My plan</b>.</p></div>") +
      items.map(function (it) {
        var upcoming = it.deadlines.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        return "<div class='card plan-item' data-id='" + esc(it.id) + "'><div class='hint'>" + esc(it.kind) + " · saved " + esc(it.saved) + "</div><h3>" + esc(it.title) + "</h3>" +
          (it.summary ? "<p>" + esc(it.summary) + "</p>" : "") +
          (upcoming.length ? "<h4>Deadlines</h4><ul class='list'>" + upcoming.map(function (d) { return "<li>" + esc(d.label) + ": <b>" + esc(d.date) + "</b> " + dueText(d) + "</li>"; }).join("") + "</ul>" : "") +
          (it.steps.length ? "<h4>Steps</h4><ol class='list'>" + it.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" : "") +
          (it.docs.length ? "<h4>Documents to gather</h4><div class='checklist'>" + it.docs.map(function (d, i) {
            return "<label><input type='checkbox' data-doc='" + i + "'" + (d.done ? " checked" : "") + "> " + esc(d.label) + "</label>"; }).join("") + "</div>" : "") +
          (it.links.length ? "<p>" + it.links.map(function (l) { return "<a href='" + esc(l.url) + "' target='_blank' rel='noopener'>" + esc(l.label) + "</a>"; }).join(" · ") + "</p>" : "") +
          "<div class='row-actions'>" + (upcoming.length ? "<button class='ghost' data-act='ics'>Add deadlines to my calendar</button>" : "") +
          "<button class='ghost' data-act='print'>Print</button><button class='ghost' data-act='del'>Remove</button></div></div>";
      }).join("") +
      "<div class='card'><h3>Add your own deadline</h3><div class='grid'><label>What is it<input id='plLabel' placeholder='e.g. Call the billing office'></label>" +
      "<label>Date<input id='plDate' type='date'></label></div><div class='row-actions'><button class='primary' id='plAdd'>Add</button></div></div>";

    if (tools) view.insertBefore(tools, view.firstChild);
    view.querySelectorAll(".plan-item").forEach(function (card) {
      var id = card.dataset.id;
      card.querySelectorAll("input[data-doc]").forEach(function (cb) {
        cb.onchange = function () { Plan.update(id, function (x) { x.docs[+cb.dataset.doc].done = cb.checked; }); };
      });
      card.querySelectorAll("button[data-act]").forEach(function (b) {
        b.onclick = function () {
          var it = Plan.all().filter(function (x) { return x.id === id; })[0]; if (!it) return;
          if (b.dataset.act === "del") { if (confirm("Remove \"" + it.title + "\" from your plan?")) { Plan.remove(id); render(); } }
          else if (b.dataset.act === "print") { document.querySelectorAll(".plan-item").forEach(function (c) { c.classList.toggle("no-print", c !== card); }); window.print(); document.querySelectorAll(".plan-item").forEach(function (c) { c.classList.remove("no-print"); }); }
          else {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([Plan.ics(it)], { type: "text/calendar" }));
            a.download = it.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40) + ".ics"; document.body.appendChild(a); a.click(); a.remove();
          }
        };
      });
    });
    document.getElementById("plAdd").onclick = function () {
      var l = document.getElementById("plLabel").value.trim(), d = document.getElementById("plDate").value;
      if (!l || !d) return;
      Plan.add({ kind: "My reminder", title: l, deadlines: [{ label: l, date: d }] }); render();
    };
  }
  document.addEventListener("view", function (e) { if (e.detail === "plan") render(); });
  document.addEventListener("plan", badge);
  badge();
  // A "Save to My plan" button any tab can drop in. getItem() builds the item at click time.
  window.planButton = function (id) { return "<button class='ghost' id='" + id + "'>☆ Save to My plan</button>"; };
  window.wirePlanButton = function (id, getItem) {
    var b = document.getElementById(id); if (!b) return;
    b.onclick = function () { Plan.add(getItem()); b.textContent = "✓ Saved to My plan"; b.disabled = true; };
  };
})();
