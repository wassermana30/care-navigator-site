// Find a hospital in the CMS national list and tell the 501(r) form who owns it.
// Ownership comes from CMS "Hospital Ownership": np = nonprofit (501(r) applies), gov = government
// (applies only if it also holds 501(c)(3) status), fp/phys = for-profit (501(r) doesn't apply).

var HospitalSearch = (function () {
  // Common names that differ from the CMS listing. Only entries confirmed against CMS data (address match).
  var ALIASES = { "ben taub": "450289" };
  var TYPE = { np: "nonprofit", gov: "government", fp: "forprofit", phys: "forprofit", other: "unsure" };
  var LABEL = { np: "nonprofit", gov: "government / public", fp: "for-profit", phys: "physician-owned (for-profit)", other: "other" };

  var GENERIC = { hospital: 1, hosptial: 1, hospitol: 1, medical: 1, center: 1, centre: 1, health: 1, regional: 1, memorial: 0, the: 1, of: 1, general: 1, clinic: 1, system: 1 };
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { var c = [i]; for (j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }

  // Every query word must appear in the name, city or state; names that start with the query rank first.
  function search(query, limit) {
    if (typeof HOSPITALS === "undefined") return [];  // list still loading
    var q = norm(query);
    if (q.length < 3) return [];
    var hits = [];
    Object.keys(ALIASES).forEach(function (a) {
      if (a.indexOf(q) === 0 || q.indexOf(a) === 0) {
        var h = HOSPITALS.filter(function (x) { return x[4] === ALIASES[a]; })[0];
        if (h) hits.push({ h: h, score: -1, alias: a });
      }
    });
    var words = q.split(" ");
    function scan(ws, fuzzy, penalty) {
      HOSPITALS.forEach(function (h) {
        var hay = norm(h[0] + " " + h[1] + " " + h[2]), hw = hay.split(" ");
        if (ws.every(function (w) { return hay.indexOf(w) >= 0 || (fuzzy && w.length >= 5 && hw.some(function (x) { return lev(w, x) <= (w.length >= 7 ? 2 : 1); })); })) {
          var n = norm(h[0]);
          hits.push({ h: h, score: penalty + (n.indexOf(q) === 0 ? 0 : n.indexOf(q) > 0 ? 1 : 2) });
        }
      });
    }
    scan(words, false, 0);
    // Nothing? Forgive typos ("hosptial", "methodst"), then ignore generic words ("hospital", "medical center").
    if (!hits.length) scan(words, true, 3);
    var core = words.filter(function (w) { return !GENERIC[w]; });
    if (!hits.length && core.length && core.length < words.length) scan(core, true, 5);
    var seen = {};
    return hits.sort(function (a, b) { return a.score - b.score || a.h[0].localeCompare(b.h[0]); })
      .filter(function (x) { if (seen[x.h[4]]) return false; seen[x.h[4]] = 1; return true; })
      .slice(0, limit || 8);
  }

  // Medicare's ownership code is sometimes out of date. HCA Healthcare is a for-profit company, so its hospitals aren't 501(r) hospitals.
  function forProfitSystem(name) { return /^hca /i.test(name) ? "HCA Healthcare" : null; }
  function describe(h) {
    var code = h[3], fps = forProfitSystem(h[0]);
    if (fps && code === "np") return { formType: "forprofit", label: "for-profit (" + fps + ")", corrected: true,
      note: "Medicare's list says nonprofit, but this hospital is run by " + fps + ", a for-profit company, so 501(r) doesn't apply. Many for-profit hospitals still offer charity care, so ask the billing office for their financial assistance policy." };
    return {
      formType: TYPE[code] || "unsure", label: LABEL[code] || code,
      note: code === "np" ? "Nonprofit, so 501(r) applies. It must have a financial assistance policy and post it."
        : code === "gov" ? "Government-owned. 501(r) applies only if it also holds 501(c)(3) status, but public hospitals usually have their own assistance program. Ask billing."
        : "For-profit, so 501(r) doesn't apply. Many still offer charity care, so ask the billing office."
    };
  }

  return { search: search, describe: describe, ALIASES: ALIASES };
})();

if (typeof module !== "undefined") module.exports = HospitalSearch;

if (typeof document !== "undefined") {
  (function () {
    var input = document.getElementById("hospitalName"), box = document.getElementById("hospSuggest"), info = document.getElementById("hospInfo");
    if (!input) return;
    var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
    input.addEventListener("focus", function () { if (window.loadHospitalData) loadHospitalData(); });
    input.addEventListener("input", function () {
      if (typeof HOSPITALS === "undefined" && window.loadHospitalData) { loadHospitalData().then(function () { input.dispatchEvent(new Event("input")); }); return; }
      input.dataset.policy = "";  // typing a new name drops the old hospital's policy
      input.dataset.inArea = "";
      var hits = HospitalSearch.search(input.value);
      info.textContent = "";
      if (!hits.length) {
        box.classList.add("hidden"); box.innerHTML = "";  // no stale suggestions from an earlier search
        if (input.value.trim().length >= 3 && typeof HOSPITALS !== "undefined")
          info.textContent = "No hospital found with that name. Check the spelling, or try just the main name and the city (for example \"Parkland Dallas\").";
        return;
      }
      box.innerHTML = hits.map(function (x, i) {
        return "<button type='button' data-i='" + i + "'>" + esc(x.h[0]) + (x.alias ? " <span class='hint'>(" + esc(x.alias.replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + ")</span>" : "") +
          " <span class='hint'>· " + esc(x.h[1]) + ", " + esc(x.h[2]) + " · " + esc(HospitalSearch.describe(x.h).label) + "</span></button>";
      }).join("");
      box.classList.remove("hidden");
      box.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () {
          var h = hits[+b.dataset.i].h, d = HospitalSearch.describe(h);
          input.value = h[0];
          document.getElementById("hospitalType").value = d.formType;
          var st = document.getElementById("state"); if (st) st.value = h[2];
          var pids = typeof HOSPITAL_POLICIES !== "undefined" && HOSPITAL_POLICIES.byCcn[h[4]], pol = pids && pids[0];
          input.dataset.policy = pol ? h[4] : "";
          info.innerHTML = "✓ " + esc(h[1]) + ", " + esc(h[2]) + ". Medicare lists it as <b>" + esc(d.label) + "</b>. " + esc(d.note) +
            (pol ? "<br>✓ <b>We have this hospital's financial assistance policy</b> (" + esc(HOSPITAL_POLICIES.policies[pol].system) + "), so your results will use its real income levels." : "");
          input.dataset.inArea = "";
          var areaPol = (pids || []).map(function (id) { return HOSPITAL_POLICIES.policies[id]; }).filter(function (x) { return x.residencyArea; })[0];
          if (areaPol) {
            info.innerHTML += "<br><label>Do you live in " + esc(areaPol.residencyArea) + "? <select id='hospInArea'><option value=''>Choose</option><option value='yes'>Yes</option><option value='no'>No</option></select></label>";
            document.getElementById("hospInArea").onchange = function (e) { input.dataset.inArea = e.target.value; };
          }
          box.classList.add("hidden");
          if (st && st.onchange) st.onchange();
        };
      });
    });
    document.addEventListener("click", function (e) { if (!box.contains(e.target) && e.target !== input) box.classList.add("hidden"); });
  })();
}
