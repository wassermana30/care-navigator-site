// Find care near me: the nearest community health centers to a ZIP code (HRSA's official list),
// plus where to look for low-cost dental care. The big data files load only when this tab opens.

var FindCare = (function () {
  function miles(a, b, c, d) {
    var R = 3958.8, r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y));
  }
  // Nearest sites to a ZIP. Returns null if the ZIP isn't known.
  function nearest(zip, n) {
    var z = ZIP_CENTROIDS[String(zip || "").trim().slice(0, 5)];
    if (!z) return null;
    return HEALTH_CENTERS.map(function (h) { return { h: h, mi: miles(z[0], z[1], h[8], h[9]) }; })
      .sort(function (a, b) { return a.mi - b.mi; }).slice(0, n || 10);
  }
  return { nearest: nearest, miles: miles };
})();

if (typeof document !== "undefined") (function () {
  var view = document.getElementById("view-findcare");
  if (!view) return;
  var loaded = false;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function load(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("couldn't load " + src)); }; document.body.appendChild(s); }); }
  function ensure() { if (loaded) return Promise.resolve(); return Promise.all([load("findcare-data.js"), load("zip-centroids.js")]).then(function () { loaded = true; }); }

  view.innerHTML =
    "<section class='tool-intro'><h2>Find low-cost care near you</h2>" +
    "<p>Community health centers see you even without insurance. <b>How much you pay depends on your income.</b> " +
    "<a class='src-link' href='https://www.healthcare.gov/community-health-centers/' target='_blank' rel='noopener'>Source: HealthCare.gov</a></p>" +
    "<div class='urgent emergency' style='margin:12px 0'><b>Emergency?</b> Call 911 or go to the nearest emergency room. Emergency rooms must examine and stabilize you even if you can't pay.</div>" +
    "<div class='searchbox'><input id='fcZip' inputmode='numeric' maxlength='5' placeholder='Your ZIP code, e.g. 77030' autocomplete='postal-code'> <button class='primary' id='fcGo'>Find health centers</button></div>" +
    "<p class='hint' id='fcMeta'></p></section>" +
    "<div id='fcResults'></div>" +
    "<div class='card'><h3>Low-cost dental care</h3><ul class='list'>" +
    "<li>Many health centers offer dental care, or can refer you. Call the ones above and ask.</li>" +
    "<li>Dental schools and dental hygiene schools often offer supervised, low-cost care.</li></ul>" +
    "<p class='hint'><a class='src-link' href='https://www.nidcr.nih.gov/health-info/finding-dental-care' target='_blank' rel='noopener'>Source: National Institute of Dental and Craniofacial Research, Finding low-cost dental care</a></p></div>" +
    "<div class='card'><h3>More ways to search</h3><ul class='list'>" +
    "<li><a href='https://findahealthcenter.hrsa.gov/' target='_blank' rel='noopener'>HRSA Find a Health Center</a> (the official map, with services and hours)</li>" +
    "<li>Not sure what kind of care you need? Use the <a href='#' id='fcToHelp'>Get help</a> tab and describe your symptoms.</li></ul></div>";

  function render(zip) {
    var out = document.getElementById("fcResults");
    if (!/^\d{5}$/.test(zip)) { out.innerHTML = "<p class='warn'>Type a 5-digit ZIP code.</p>"; return; }
    out.innerHTML = "<p class='hint'>Looking…</p>";
    ensure().then(function () {
      document.getElementById("fcMeta").textContent = HEALTH_CENTERS_META.count.toLocaleString() + " health center sites from HRSA's official list, downloaded " + HEALTH_CENTERS_META.downloaded + ". Call ahead: hours and services change.";
      var hits = FindCare.nearest(zip, 10);
      if (!hits) { out.innerHTML = "<p class='warn'>I don't know ZIP code " + esc(zip) + ". Check it, or try a nearby ZIP.</p>"; return; }
      out.innerHTML = "<div class='card'><h3>Nearest community health centers</h3>" + hits.map(function (x) {
        var h = x.h, addr = h[2] + ", " + h[3] + ", " + h[4] + " " + h[5];
        return "<div class='site'><span class='dist'>" + (x.mi < 0.1 ? "here" : x.mi.toFixed(1) + " mi") + "</span><b>" + esc(h[0]) + "</b><br>" +
          "<span class='hint'>" + esc(h[1]) + "</span><br>" + esc(addr) + "<br>" +
          (h[6] ? "<a href='tel:" + esc(h[6].replace(/[^0-9+]/g, "")) + "'>" + esc(h[6]) + "</a> · " : "") +
          "<a href='https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(h[0] + ", " + addr) + "' target='_blank' rel='noopener'>Map</a>" +
          (h[7] ? " · <a href='" + esc(h[7]) + "' target='_blank' rel='noopener'>Website</a>" : "") +
          (h[10] && +h[10] > 0 ? " <span class='hint'>· open about " + esc(h[10]) + " hours a week</span>" : "") + "</div>";
      }).join("") + "<p class='hint'>When you call, ask: \"Do you have a sliding fee scale based on income?\" and \"Can I get an appointment this week?\"</p></div>" + helpfulBox("fbFind");
      wireHelpful("fbFind", "Find care");
    }).catch(function (e) { out.innerHTML = "<p class='warn'>Couldn't load the health center list (" + esc(e.message) + ").</p>"; });
  }
  document.getElementById("fcGo").onclick = function () { render(document.getElementById("fcZip").value.trim()); };
  document.getElementById("fcZip").onkeydown = function (e) { if (e.key === "Enter") document.getElementById("fcGo").click(); };
  document.getElementById("fcToHelp").onclick = function (e) { e.preventDefault(); showView("meds"); };
  window.findCareFor = function (zip) { showView("findcare"); if (zip) { document.getElementById("fcZip").value = zip; render(zip); } };
})();
