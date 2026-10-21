// Save & share: email or text a plan to yourself, print it, and print a pre-filled worksheet
// for programs whose official form isn't a fillable PDF. Nothing is sent by this page itself:
// email/text open the person's own mail or messages app with the plan filled in.

var Share = (function () {
  var STALE_DAYS = 60;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  function daysSince(isoDate, now) {
    var p = String(isoDate || "").split("-").map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    var then = Date.UTC(p[0], p[1] - 1, p[2]);
    var n = now || new Date();
    return Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - then) / 86400000);
  }

  // Warning shown on any program whose rules haven't been re-checked recently.
  function freshness(p, now) {
    var d = daysSince(p.verified, now);
    if (d === null) return "<p class='stale'>⚠ We don't have a date for when these rules were checked. Call the program to confirm.</p>";
    if (d > STALE_DAYS) return "<p class='stale'>⚠ These rules were last checked " + d + " days ago. Programs change often, so call to confirm before applying.</p>";
    return "";
  }

  // Plain-text version of a plan, for email / SMS / clipboard.
  function planText(title, sections) {
    var lines = [title, ""];
    sections.forEach(function (s) {
      if (!s.items || !s.items.length) return;
      lines.push(s.heading.toUpperCase());
      s.items.forEach(function (it, i) { lines.push((s.numbered ? (i + 1) + ". " : "- ") + it); });
      lines.push("");
    });
    lines.push("Made with Care Navigator (prototype). This is guidance on where to get care and how to pay for it, not a diagnosis.");
    return lines.join("\n");
  }

  function bar(id) {
    return "<div class='share-bar no-print' id='" + id + "'><span class='hint'>Save this plan:</span> " +
      "<button class='ghost' data-act='email'>Email it to me</button> <button class='ghost' data-act='sms'>Text it to me</button> " +
      "<button class='ghost' data-act='copy'>Copy</button> <button class='ghost' data-act='print'>Print</button> <span class='share-out hint'></span></div>";
  }

  function wire(id, getText, subject) {
    var el = document.getElementById(id); if (!el) return;
    el.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        var text = getText(), out = el.querySelector(".share-out");
        if (b.dataset.act === "email") location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
        else if (b.dataset.act === "sms") location.href = "sms:?&body=" + encodeURIComponent(text);
        else if (b.dataset.act === "print") window.print();
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { out.textContent = "Copied."; }, function () { out.textContent = "Couldn't copy. Select and copy the plan instead."; });
      };
    });
  }

  // A printable worksheet: the patient answers every application asks for, this program's
  // document list and steps, and blank lines for the parts only the patient/doctor can fill.
  function worksheet(p, answers, fplPct) {
    var INS = { none: "No insurance", commercial: "Private / job insurance", medicare: "Medicare", medicaid: "Medicaid", va: "VA / TRICARE" };
    var row = function (k, v) { return "<tr><td>" + esc(k) + "</td><td>" + (v ? esc(v) : "<span class='blank'></span>") + "</td></tr>"; };
    var html = "<!doctype html><html><head><meta charset='utf-8'><title>Worksheet: " + esc(p.program) + "</title><style>" +
      "body{font:13px/1.45 -apple-system,Segoe UI,sans-serif;max-width:7.5in;margin:24px auto;color:#111}h1{font-size:18px;margin:0}h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ccc}" +
      "table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top}td:first-child{width:42%;color:#555}" +
      ".blank{display:inline-block;width:100%;border-bottom:1px solid #999;height:14px}.hint{color:#666;font-size:12px}li{margin:3px 0}@media print{button{display:none}}" +
      "</style></head><body><button onclick='window.print()'>Print</button>" +
      "<h1>Application worksheet: " + esc(p.program) + "</h1><p class='hint'>Use this to fill in the program's official application. It is not the application itself. " +
      (p.applyUrl ? "Official page: " + esc(p.applyUrl) + ". " : "") + (p.phone ? "Phone: " + esc(p.phone) + "." : "") + "</p>" +
      "<h2>Patient section (copy onto the official form)</h2><table>" +
      row("Full name", "") + row("Date of birth", "") + row("Address", "") + row("Phone / email", "") +
      row("Medication", answers.drug) + row("Household size", answers.householdSize) +
      row("Household income (yearly, before taxes)", answers.income !== undefined ? "$" + Number(answers.income).toLocaleString() : "") +
      row("Income as % of 2026 poverty guideline", fplPct !== null && fplPct !== undefined ? fplPct + "%" : "") +
      row("Insurance", INS[answers.insurance]) + row("Lives in the US", answers.usResident === true ? "Yes" : answers.usResident === false ? "No" : "") + "</table>" +
      (p.documents && p.documents.length ? "<h2>Documents to attach</h2><ul>" + p.documents.map(function (d) { return "<li>☐ " + esc(d) + "</li>"; }).join("") + "</ul>" : "") +
      (p.howToApply && p.howToApply.length ? "<h2>How to apply</h2><ol>" + p.howToApply.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ol>" : "") +
      (p.prescriberRequired ? "<h2>Doctor's section</h2><p>Your doctor must complete and sign the prescriber section of the official form.</p><table>" + row("Doctor's name", "") + row("Office phone / fax", "") + "</table>" : "") +
      "<p class='hint'>Program rules checked " + esc(p.verified) + ". Programs change, so confirm with the program before sending.</p></body></html>";
    var w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    return html;
  }

  return { daysSince: daysSince, freshness: freshness, planText: planText, bar: bar, wire: wire, worksheet: worksheet, STALE_DAYS: STALE_DAYS };
})();

if (typeof module !== "undefined") module.exports = Share;
