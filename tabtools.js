// Undo and Clear on every tab that has something to change.
// Undo takes back the last change on that tab (an edited field, a choice, a removed item, or a Clear).
// Each tab says how to capture its state and how to put it back; nothing is stored outside this page.

var TabTools = (function () {
  function same(a, b, ignore) {
    var strip = function (x) { var y = Object.assign({}, x); (ignore || []).forEach(function (k) { delete y[k]; }); return JSON.stringify(y); };
    return strip(a) === strip(b);
  }
  // cfg: { view, capture(), restore(state), clear(), ignore: [keys that don't count as a change], clearButton: existing element or null, confirmClear: text or null }
  function make(cfg) {
    var view = document.getElementById("view-" + cfg.view); if (!view) return null;
    var stack = [], last = cfg.capture(), busy = false;
    var bar = document.createElement("div"); bar.className = "tab-tools no-print";
    bar.innerHTML = "<button type='button' class='clear-btn undo-btn hidden' title='Take back your last change on this tab'>↩ Undo</button>" +
      (cfg.clearButton ? "" : "<button type='button' class='clear-btn' title='Clear everything on this tab'>Clear</button>");
    var undoBtn = bar.querySelector(".undo-btn"), clearBtn = cfg.clearButton || bar.querySelector(".clear-btn:not(.undo-btn)");
    if (cfg.clearButton) { cfg.clearButton.parentNode.insertBefore(undoBtn, cfg.clearButton); bar = null; }
    else view.insertBefore(bar, view.firstChild);
    function show() { undoBtn.classList.toggle("hidden", !stack.length); }
    function changed() {
      if (busy) return;
      var now = cfg.capture();
      if (same(now, last, cfg.ignore)) { last = now; return; }
      stack.push(last); if (stack.length > 50) stack.shift(); last = now; show();
    }
    function undo() {
      var s = stack.pop(); if (!s) return;
      busy = true; try { cfg.restore(s); } finally { busy = false; }
      last = cfg.capture(); show();
    }
    var origClear = cfg.clearButton ? cfg.clearButton.onclick : null;
    clearBtn.onclick = function (e) {
      if (cfg.confirmClear && !confirm(cfg.confirmClear)) return;
      changed();
      var before = cfg.capture();
      busy = true; try { (cfg.clear || origClear).call(clearBtn, e); } finally { busy = false; }
      var after = cfg.capture();
      if (!same(before, after, cfg.ignore)) { stack.push(before); last = after; show(); }
    };
    undoBtn.onclick = undo;
    view.addEventListener("change", function () { setTimeout(changed, 0); });
    document.addEventListener("tabchange", function (e) { if (e.detail === cfg.view) setTimeout(changed, 0); });
    return { changed: changed, undo: undo, size: function () { return stack.length; } };
  }
  return { make: make };
})();

if (typeof document !== "undefined") (function () {
  var $ = function (id) { return document.getElementById(id); };
  function vals(root) {
    var o = {};
    root.querySelectorAll("input[id], select[id], textarea[id]").forEach(function (el) { o[el.id] = el.type === "checkbox" ? el.checked : el.value; });
    return o;
  }
  function setVals(root, o) {
    Object.keys(o).forEach(function (id) { var el = document.getElementById(id); if (!el || !root.contains(el)) return; if (el.type === "checkbox") el.checked = o[id]; else el.value = o[id]; });
  }
  function tick(view) { document.dispatchEvent(new CustomEvent("tabchange", { detail: view })); }

  // ---------- Hospital bill
  var billFields = function () { var o = vals($("step-1")); Object.assign(o, vals($("step-2"))); delete o.hospInArea; return o; };
  window.billTools = TabTools.make({
    view: "patient", clearButton: $("clearBill"), ignore: ["step"],
    capture: function () {
      var step = 1; [1, 2, 3, 4].forEach(function (n) { if ($("step-" + n) && !$("step-" + n).classList.contains("hidden")) step = n; });
      return { f: billFields(), timing: (document.querySelector("input[name=timing]:checked") || {}).value || "after",
        incomes: Array.prototype.map.call(document.querySelectorAll(".income-row"), function (r) { return { kind: r.querySelector(".kind").value, amount: r.querySelector(".amount").value, freq: r.querySelector(".freq").value }; }),
        policy: $("hospitalName").dataset.policy || "", inArea: $("hospitalName").dataset.inArea || "", info: $("hospInfo").innerHTML, step: step };
    },
    restore: function (s) {
      setVals($("view-patient"), s.f);
      var t = document.querySelector("input[name=timing][value='" + s.timing + "']"); if (t) { t.checked = true; setTiming(s.timing); }
      $("incomeRows").innerHTML = ""; (s.incomes.length ? s.incomes : [null]).forEach(function (r) { addIncomeRow(r || undefined); });
      $("hospitalName").dataset.policy = s.policy; $("hospitalName").dataset.inArea = s.inArea; $("hospInfo").innerHTML = s.info;
      var q = $("hospInArea"); if (q) { q.value = s.inArea; q.onchange = function (e) { $("hospitalName").dataset.inArea = e.target.value; }; }
      go(s.step);
    }
  });
  // Changes that don't fire a "change" event
  document.addEventListener("click", function (e) {
    if (e.target.closest("#addIncome, .income-row .x, #loadExample, #hospSuggest button, [data-go]")) setTimeout(function () { tick("patient"); }, 0);
  });

  // ---------- Fight a bill
  TabTools.make({
    view: "fight",
    capture: function () {
      var s = window.FightUI ? FightUI.current() : null, out = $("fbOut");
      return { s: s, f: s ? vals(out) : {}, made: !!$("fbText"), letter: $("fbText") ? $("fbText").value : "" };
    },
    restore: function (st) {
      if (!st.s) { FightUI.reset(); return; }
      FightUI.render(st.s); setVals($("fbOut"), st.f);
      if (st.made) { $("fbMake").click(); if ($("fbText")) $("fbText").value = st.letter; }
    },
    clear: function () { FightUI.reset(); }
  });
  document.addEventListener("click", function (e) { if (e.target.closest("#fbMake")) setTimeout(function () { tick("fight"); }, 0); });

  // ---------- Get covered
  var gcDefaults = null;
  TabTools.make({
    view: "covered",
    capture: function () { var f = vals($("view-covered")); if (!gcDefaults) gcDefaults = f; return { f: f, shown: !!$("gcOut").innerHTML.trim() }; },
    restore: function (s) {
      setVals($("view-covered"), s.f); $("gcSavingsWrap").classList.toggle("hidden", !s.f.gcMedicare);
      if (s.shown) $("gcGo").click(); else $("gcOut").innerHTML = "";
    },
    clear: function () { setVals($("view-covered"), gcDefaults); $("gcSavingsWrap").classList.add("hidden"); $("gcOut").innerHTML = ""; }
  });
  document.addEventListener("click", function (e) { if (e.target.closest("#gcGo")) setTimeout(function () { tick("covered"); }, 0); });

  // ---------- Find care
  TabTools.make({
    view: "findcare",
    capture: function () { return { zip: $("fcZip").value, shown: !!$("fcResults").innerHTML.trim() }; },
    restore: function (s) { $("fcZip").value = s.zip; if (s.shown) $("fcGo").click(); else { $("fcResults").innerHTML = ""; } },
    clear: function () { $("fcZip").value = ""; $("fcResults").innerHTML = ""; }
  });
  document.addEventListener("click", function (e) { if (e.target.closest("#fcGo")) setTimeout(function () { tick("findcare"); }, 0); });

  // ---------- My plan (saved items live in localStorage)
  function planRaw() { try { return localStorage.getItem(Plan.KEY) || "[]"; } catch (e) { return "[]"; } }
  function planRefresh() { document.dispatchEvent(new CustomEvent("plan")); if (!$("view-plan").classList.contains("hidden")) document.dispatchEvent(new CustomEvent("view", { detail: "plan" })); }
  TabTools.make({
    view: "plan", confirmClear: "Remove everything from My plan? You can undo this right after.",
    capture: function () { return { raw: planRaw() }; },
    restore: function (s) { try { localStorage.setItem(Plan.KEY, s.raw); } catch (e) {} planRefresh(); },
    clear: function () { try { localStorage.setItem(Plan.KEY, "[]"); } catch (e) {} planRefresh(); }
  });
  document.addEventListener("plan", function () { tick("plan"); });

  // ---------- Hospital dashboard (staff): saved applications and feedback answers
  function dashRaw() { try { return { cases: localStorage.getItem(STORE) || "[]", fb: localStorage.getItem(Feedback.KEY) || "[]" }; } catch (e) { return { cases: "[]", fb: "[]" }; } }
  var origSave = window.saveCases;
  window.saveCases = function (c) { origSave(c); tick("hospital"); };
  var origFbClear = Feedback.clear;
  Feedback.clear = function () { origFbClear(); tick("hospital"); };
  TabTools.make({
    view: "hospital", clearButton: $("clearData"),
    capture: dashRaw,
    restore: function (s) { try { localStorage.setItem(STORE, s.cases); localStorage.setItem(Feedback.KEY, s.fb); } catch (e) {} renderDashboard(); }
  });
})();
