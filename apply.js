// "Next: fill out your hospital's application": the last step of the Hospital bill tab.
// 501(r) itself isn't a form: every nonprofit hospital has its own financial assistance application, and must post it
// online and give free paper copies (IRS). This takes people straight to their hospital's form (HOSPITAL_APPS, checked
// links), lays out their answers field by field to copy onto it, and says how to turn it in.

var ApplyStep = (function () {
  var IRS = "https://www.irs.gov/charities-non-profits/financial-assistance-policies-faps";
  var INCOME_KIND = { wages: "Job (pay stubs)", self: "Self-employed", benefits: "Benefits (SS, unemployment)", other: "Other" };
  var FREQ = { weekly: "per week", biweekly: "every 2 weeks", semimonthly: "twice a month", monthly: "per month", annual: "per year" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  // First real phone number in text like "314-362-8400 or 855-362-8400" or "1-877-HHC-Bill (877-442-2455)".
  function dial(p) { var m = String(p).match(/(?:1[- ])?\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4}/); return m ? m[0].replace(/[^0-9]/g, "") : String(p).replace(/[^0-9]/g, ""); }
  function money(n) { return "$" + Math.round(+n || 0).toLocaleString(); }

  // Where to get the form: the checked application link, or the best fallback we have.
  function source(answers, result) {
    var K = result.policy && result.policy.known, app = K && typeof HOSPITAL_APPS !== "undefined" ? HOSPITAL_APPS[K.id] : null;
    var name = answers.hospitalName || (K && K.system) || "your hospital";
    return {
      name: name, system: K ? K.system.replace(/\s*\([^)]*\)/g, "") : null, app: app && app.applicationUrl && app.verified ? app : null, partial: app,
      page: K && K.applyUrl, phone: (app && app.phone) || (K && K.applyPhone) || null,
      search: "https://www.google.com/search?q=" + encodeURIComponent('"' + name + '" financial assistance application')
    };
  }

  // The answers most applications ask for, in the order forms usually ask.
  function fields(a, r) {
    var out = [
      ["Patient name", a.name || ""], ["Phone or email", a.contact || ""], ["Hospital", a.hospitalName || ""],
      ["Account number (on your bill)", a.account || ""],
      a.timing === "before" ? ["Date of scheduled care", a.scheduledDate || ""] : ["Date of first bill", a.firstBillDate || ""],
      ["Amount billed", a.billAmount ? money(a.billAmount) : ""], ["State you live in", a.state || ""],
      ["People in your household", a.householdSize || ""],
      ["Household income per year (before taxes)", money(r.income)], ["Household income per month (before taxes)", money(r.income / 12)],
      ["Health insurance", { none: "None (uninsured)", private: "Private / job", medicare: "Medicare", medicaid: "Medicaid" }[a.insurance] || ""]
    ];
    (a.incomeSources || []).forEach(function (s, i) { out.push(["Income source " + (i + 1), (INCOME_KIND[s.kind] || s.kind) + ": " + money(s.amount) + " " + (FREQ[s.freq] || s.freq)]); });
    return out;
  }

  function html(a, r) {
    var src = source(a, r), app = src.app, sub = app ? app.submit || {} : {};
    var getForm = app
      ? "<div class='row-actions'>" +
          (app.format !== "online" ? "<a class='primary btn-link' href='" + esc(app.applicationUrl) + "' target='_blank' rel='noopener'>Open " + esc(src.system || src.name) + "'s application</a>" : "") +
          (app.onlineUrl || app.format === "online" ? "<a class='primary btn-link' href='" + esc(app.onlineUrl || app.applicationUrl) + "' target='_blank' rel='noopener'>Apply online</a>" : "") +
          (app.spanishUrl ? "<a class='ghost btn-link' href='" + esc(app.spanishUrl) + "' target='_blank' rel='noopener'>Solicitud en español</a>" : "") +
        "</div><p class='hint'><span>Official form from the hospital's own website, link checked " + esc(app.checked) + ".</span> " + (app.tip ? "<span>" + esc(app.tip) + "</span>" : "") + "</p>"
      : "<p>" + (src.page ? "Here is " + esc(src.system || src.name) + "'s financial assistance page. The application is posted there." : (r.coverage && r.coverage.status === "no" ? "Ask the billing office for their financial assistance (charity care) application. Many hospitals have one even when federal 501(r) rules don't apply." : "Every nonprofit hospital must post its application on its website and give you a free paper copy.")) + "</p>" +
        "<div class='row-actions'>" + (src.page ? "<a class='primary btn-link' href='" + esc(src.page) + "' target='_blank' rel='noopener'>Open the hospital's financial assistance page</a>" : "") +
        "<a class='ghost btn-link' href='" + esc(src.search) + "' target='_blank' rel='noopener'>Search for " + esc(src.name) + "'s application</a></div>" +
        "<p class='hint'>The IRS says nonprofit hospitals must make the FAP application form \"widely available on a Web site\" and give \"paper copies... upon request and without charge.\" <a href='" + IRS + "' target='_blank' rel='noopener'>IRS</a></p>";
    if (!app && src.partial && src.partial.tip) getForm += "<p class='hint'>" + esc(src.partial.tip) + "</p>";
    var call = src.phone ? "<p>Or call billing and ask for the financial assistance application: <a href='tel:" + esc(dial(src.phone)) + "'>" + esc(String(src.phone).replace(/ or /g, " / ")) + "</a></p>" : "<p>Or ask for a paper copy at the hospital's registration desk or billing office. It's free.</p>";
    var turnIn = [sub.online || app && app.format === "online" ? "Online, through the hospital's application page" : "",
      sub.mail ? "By mail: " + sub.mail : "", sub.fax ? "By fax: " + sub.fax : "", sub.email ? "By email: " + sub.email : "", sub.inPerson ? (typeof I18N === "undefined" || I18N.lang === "en" ? "In person: " + sub.inPerson : "In person: at the hospital's billing or financial counseling office. Call first to ask where.") : ""].filter(Boolean);
    var rows = fields(a, r);
    var dl = r.deadlines;
    return "<div class='card apply-step'>" +
      "<h2>Next: fill out " + esc(src.name) + "'s application</h2>" +
      "<p class='hint'>501(r) is the law. The form you fill out is your hospital's own financial assistance application. Here's how to get it and fill it out.</p>" +
      "<h3>1. Get the form</h3>" + getForm + call +
      "<h3>2. Fill it out with your answers</h3><p class='hint'>Copy these onto the form. Use the same numbers you entered here.</p>" +
      "<table class='apply-fields'>" + rows.map(function (f, i) {
        return "<tr><td>" + esc(f[0]) + "</td><td>" + (f[1] ? esc(f[1]) + " <button type='button' class='ghost copy-btn' data-copy='" + i + "'>Copy</button>" : "<span class='hint'>add this on the form</span>") + "</td></tr>";
      }).join("") + "</table>" +
      "<h3>3. Attach these documents</h3><div class='checklist'>" + (r.documents || []).map(function (d) { return "<label><input type='checkbox'> " + esc(d) + "</label>"; }).join("") + "</div>" +
      "<h3>4. Turn it in</h3>" +
      (turnIn.length ? "<ul class='list'>" + turnIn.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "<p>Send it the way the form says, or hand it in at the hospital's billing or financial counseling office.</p>") +
      "<ul class='list'><li>Keep a copy of everything you send.</li><li>Ask for a receipt, or write down the date and who you gave it to.</li>" +
      (dl ? "<li>Turn it in by " + esc(dl.applyBy) + ". Once your application is complete, the hospital must pause collection actions while it decides.</li>" : "") +
      "<li>If you don't hear back in 2 weeks, call billing and ask about your application.</li></ul>" +
      "<div class='row-actions'><button type='button' class='ghost' id='applyPrint'>Print my answers</button>" + (typeof planButton === "function" ? planButton("planApply") : "") + "</div>" +
      "</div>";
  }

  function wire(root, a, r) {
    var rows = fields(a, r), src = source(a, r);
    root.querySelectorAll(".copy-btn").forEach(function (b) {
      b.onclick = function () {
        var v = String(rows[+b.dataset.copy][1]);
        var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, done); else done();
      };
    });
    var pr = root.querySelector("#applyPrint");
    if (pr) pr.onclick = function () {
      var w = window.open("", "_blank"); if (!w) return;
      var T = function (t) { var x = typeof I18N !== "undefined" && I18N.lang !== "en" ? I18N.tr(String(t)) : null; return x == null ? String(t) : x; };
      w.document.write("<html lang='" + (typeof I18N !== "undefined" ? I18N.lang : "en") + "'><title>" + esc(T("My answers for " + src.name)) + "</title><body style='font:15px/1.5 Georgia,serif;max-width:680px;margin:30px auto'><h2>" + esc(T("My answers for " + src.name + "'s financial assistance application")) + "</h2><table cellpadding='6' border='1' style='border-collapse:collapse;width:100%'>" +
        rows.map(function (f) { return "<tr><td>" + esc(T(f[0])) + "</td><td>" + esc(f[1] ? T(f[1]) : "") + "</td></tr>"; }).join("") + "</table><h3>" + esc(T("Documents to attach")) + "</h3><ul>" +
        (r.documents || []).map(function (d) { return "<li>&#9744; " + esc(T(d)) + "</li>"; }).join("") + "</ul></body></html>");
      w.document.close(); w.print();
    };
    if (typeof wirePlanButton === "function") wirePlanButton("planApply", function () {
      var app = src.app, links = [];
      if (app) { if (app.applicationUrl) links.push({ label: "Application form", url: app.applicationUrl }); if (app.onlineUrl) links.push({ label: "Apply online", url: app.onlineUrl }); }
      else if (src.page) links.push({ label: "Hospital's financial assistance page", url: src.page });
      return { kind: "Hospital bill", title: "Apply for financial assistance: " + src.name, summary: "Fill out the hospital's own application and turn it in.",
        steps: ["Get the application form" + (src.phone ? " (or call " + src.phone + ")" : ""), "Fill it out with your answers", "Attach the documents below", "Turn it in and keep a copy", "Call if you don't hear back in 2 weeks"],
        deadlines: r.deadlines ? [{ label: "Turn in the application by", date: r.deadlines.applyBy }] : [], docs: r.documents || [], links: links };
    });
  }
  return { html: html, wire: wire, source: source, fields: fields, dial: dial };
})();
