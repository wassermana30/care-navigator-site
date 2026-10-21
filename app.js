// Page wiring. Screening math lives in logic.js; hospital settings in config.js.

var $ = function (id) { return document.getElementById(id); };
var money = function (n) { return "$" + Math.round(n).toLocaleString(); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
var todayStr = function () { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

var STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
var STATUSES = ["Screened", "Documents gathered", "Submitted", "Approved", "Denied"];
var STORE = "nav501r.cases";
var last = null; // { answers, result }

// ---------------------------------------------------------------- setup
$("state").innerHTML = STATES.map(function (s) { return "<option" + (s === "TX" ? " selected" : "") + ">" + s + "</option>"; }).join("");
$("sample-banner").textContent = "Student prototype, not medical advice. The symptom checker has not yet been reviewed by a nurse or doctor. Hospital-bill results use your hospital's policy or your state's law; medication rules come from each program's official site on the date shown. In an emergency, call 911.";

function addIncomeRow(src) {
  src = src || { kind: "wages", amount: "", freq: "biweekly" };
  var row = document.createElement("div");
  row.className = "income-row";
  row.innerHTML =
    '<select class="kind"><option value="wages">Job (pay stub)</option><option value="self">Self-employed</option>' +
    '<option value="benefits">Benefits (SS, unemployment)</option><option value="other">Other</option></select>' +
    '<input class="amount" type="number" min="0" placeholder="Amount ($)">' +
    '<select class="freq"><option value="weekly">per week</option><option value="biweekly">every 2 weeks</option>' +
    '<option value="semimonthly">twice a month</option><option value="monthly">per month</option><option value="annual">per year</option></select>' +
    '<button class="x" title="Remove">×</button>';
  row.querySelector(".kind").value = src.kind;
  row.querySelector(".amount").value = src.amount;
  row.querySelector(".freq").value = src.freq;
  row.querySelector(".x").onclick = function () { row.remove(); };
  $("incomeRows").appendChild(row);
}
function setTiming(value) {
  var before = value === "before";
  document.querySelectorAll(".tchoice").forEach(function (l) { l.classList.toggle("on", l.querySelector("input").value === value); });
  $("billHeading").textContent = before ? "Your upcoming procedure" : "Your hospital bill";
  $("schedWrap").classList.toggle("hidden", !before);
  $("firstBillWrap").classList.toggle("hidden", before);
  $("accountWrap").classList.toggle("hidden", before);
  $("amountLabel").textContent = before ? "Estimated cost ($), if you know it" : "Amount you owe ($)";
}
document.querySelectorAll("input[name=timing]").forEach(function (r) { r.onchange = function () { setTiming(r.value); }; });
$("addIncome").onclick = function () { addIncomeRow(); };
addIncomeRow();

function answers() {
  var rows = Array.prototype.slice.call(document.querySelectorAll(".income-row"));
  return {
    name: $("name").value.trim(), contact: $("contact").value.trim(),
    hospitalName: $("hospitalName").value.trim(), hospitalType: $("hospitalType").value,
    hospPolicyId: $("hospitalName").dataset.policy || "",
    inArea: $("hospitalName").dataset.inArea === "yes" ? true : $("hospitalName").dataset.inArea === "no" ? false : undefined,
    careType: $("careType").value, account: $("account").value.trim(),
    timing: document.querySelector("input[name=timing]:checked").value, scheduledDate: $("scheduledDate").value,
    hospFree: $("hospFree").value, hospDiscount: $("hospDiscount").value,
    billAmount: Number($("billAmount").value) || 0, firstBillDate: $("firstBillDate").value,
    state: $("state").value, insurance: $("insurance").value,
    inCollections: $("inCollections").checked, hasRxCosts: $("hasRxCosts").checked,
    householdSize: Math.max(1, parseInt($("householdSize").value, 10) || 1),
    incomeSources: rows.map(function (r) {
      return { kind: r.querySelector(".kind").value, amount: Number(r.querySelector(".amount").value) || 0, freq: r.querySelector(".freq").value };
    }).filter(function (s) { return s.amount > 0; })
  };
}

// Hypothetical case from the discovery interviews: "I make 45 grand and have a 90 grand bill."
$("clearBill").onclick = function () {
  $("hospitalName").dataset.policy = ""; $("hospitalName").dataset.inArea = "";
  document.querySelectorAll("#step-1 input, #step-2 input").forEach(function (el) {
    if (el.type === "checkbox" || el.type === "radio") el.checked = false; else el.value = "";
  });
  document.querySelector("input[name=timing][value=after]").checked = true; setTiming("after");
  $("hospitalType").value = "unsure"; $("careType").value = "hospital"; $("insurance").value = "none"; $("state").value = "TX";
  $("householdSize").value = 1;
  $("incomeRows").innerHTML = ""; addIncomeRow();
  $("hospInfo").textContent = ""; $("hospSuggest").classList.add("hidden");
  var pol = document.querySelector(".hosp-policy"); if (pol) pol.open = false;
  $("results").innerHTML = ""; $("packet").innerHTML = "";
  last = null;
  go(1);
};

$("loadExample").onclick = function () {
  document.querySelector("input[name=timing][value=after]").checked = true; setTiming("after");
  $("name").value = "Jordan Example (hypothetical)"; $("contact").value = "jordan@example.com";
  $("hospitalName").value = "Sample Community Hospital"; $("hospitalType").value = "nonprofit";
  $("careType").value = "hospital"; $("account").value = "000123456";
  $("billAmount").value = 90000; $("state").value = "TX"; $("insurance").value = "none";
  var d = new Date(); d.setDate(d.getDate() - 45); $("firstBillDate").value = d.toISOString().slice(0, 10);
  $("householdSize").value = 1; $("incomeRows").innerHTML = "";
  addIncomeRow({ kind: "wages", amount: 1730.77, freq: "biweekly" });
};

// ---------------------------------------------------------------- navigation
function go(n) {
  if (n >= 3) {
    var a = answers();
    last = { answers: a, result: NavLogic.screen(a, NAV_CONFIG, todayStr()) };
    renderResults(); renderPacket();
  }
  document.querySelectorAll(".step").forEach(function (s) { s.classList.add("hidden"); });
  $("step-" + n).classList.remove("hidden");
  document.querySelectorAll(".steps li").forEach(function (li) { li.classList.toggle("on", +li.dataset.step <= n); });
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(+b.dataset.go); }; });

// Switch tabs. Other modules can call showView("findcare") and listen for the "view" event.
function showView(name) {
  document.querySelectorAll(".tab[data-view]").forEach(function (x) {
    x.classList.toggle("active", x.dataset.view === name);
    if (x.dataset.view === name && x.scrollIntoView && !x.closest(".more-menu")) x.scrollIntoView({ inline: "center", block: "nearest" });
  });
  var more = document.querySelector("details.more");
  if (more) { more.open = false; more.querySelector("summary").classList.toggle("active", name === "compare" || name === "hospital"); }
  document.querySelectorAll("main[id^='view-']").forEach(function (m) { m.classList.toggle("hidden", m.id !== "view-" + name); });
  if (name === "patient" && window.loadHospitalData) loadHospitalData();
  if (name === "hospital") renderDashboard();
  if (name === "compare" && window.renderCompare) renderCompare();
  document.dispatchEvent(new CustomEvent("view", { detail: name }));
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tab[data-view]").forEach(function (t) { t.onclick = function () { showView(t.dataset.view); }; });

// ---------------------------------------------------------------- results
function verdict(r) {
  if (r.coverage.status === "no") return "Not covered by 501(r)";
  if (!r.policy || /-info$/.test(r.policy.source)) return "Depends on your hospital's policy";
  if (!r.tier) return "Depends on your hospital's policy";
  return r.tier.label + (r.coverage.status === "check" && r.policy.source !== "state" ? " (if covered)" : "");
}

function renderResults() {
  var a = last.answers, r = last.result, dl = r.deadlines;
  var html = r.warnings.map(function (w) { return '<div class="warn">' + esc(w) + "</div>"; }).join("");
  html +=
    '<div class="headline">' +
    '<div class="stat"><div class="k">Household income</div><div class="v">' + money(r.income) + "</div><div class='hint'>" + r.pct + "% of the " + NAV_CONFIG.FPL.year + " poverty line (" + money(r.povertyLine) + ")</div></div>" +
    '<div class="stat"><div class="k">Likely result</div><div class="v" style="font-size:18px">' + esc(verdict(r)) + "</div><div class='hint'>" + (r.policy && !/-info$/.test(r.policy.source) ? "Based on " + esc(r.policy.source === "state" ? a.state + " law" : "your hospital's policy") : r.policy ? (r.policy.source === "hospital-info" ? "See the hospital's policy (below)" : "See what " + esc(a.state) + " law says (below)") : "No state minimum found for " + esc(a.state || "your state")) + "</div></div>" +
    '<div class="stat"><div class="k">Estimated savings</div><div class="v">' + (!r.policy || /-info$/.test(r.policy.source) ? "Unknown" : r.tier && r.tier.discount === null ? "Varies" : (r.policy.known && r.tier && r.tier.discount > 0 && r.tier.discount < 100 ? "About " : "") + money(r.estimatedSavings)) + "</div><div class='hint'>" + (!r.policy || /-info$/.test(r.policy.source) ? "until you check the hospital's policy" : "on a " + money(a.billAmount) + (a.timing === "before" ? " estimated cost" : " bill")) + "</div></div>" +
    "</div>";
  html += policyBlock(a, r);
  html += "<h3>Does 501(r) cover this bill? <span class='pill " + r.coverage.status + "'>" + { yes: "Yes", no: "No", check: "Check" }[r.coverage.status] + "</span></h3><p>" + esc(r.coverage.why) + "</p>";
  if (r.planAhead) {
    var pa = r.planAhead;
    html += "<h3>Planning ahead" + (pa.daysUntil !== null ? " (" + (pa.daysUntil >= 0 ? pa.daysUntil + " days until your procedure" : "date has passed") + ")" : "") + "</h3>" +
      "<p>Getting approved <b>before</b> surgery means you know your price up front, instead of fighting a bill afterward.</p>" +
      "<ol class='list'>" + pa.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>";
  } else if (dl) {
    html += "<h3>Deadlines</h3><ul class='list'>" +
      "<li>Apply by <b>" + dl.applyBy + "</b> (" + (dl.daysLeft >= 0 ? dl.daysLeft + " days left" : Math.abs(dl.daysLeft) + " days ago") + "). The hospital must accept applications for at least 240 days after your first bill.</li>" +
      "<li>" + (dl.collectionsPossible ? "The hospital is now allowed to send the bill to collections or report it to credit agencies. Applying puts those actions on hold while your application is reviewed." : "The hospital cannot send this to collections or credit agencies before <b>" + dl.collectionsAllowedFrom + "</b>.") + "</li></ul>";
  } else if (!r.planAhead) {
    html += "<h3>Deadlines</h3><p class='hint'>Add the date of your first bill to see your deadline.</p>";
  }
  if (a.inCollections) html += "<div class='warn'>Already in collections? Apply anyway. If you qualify, the hospital has to refund overpayments and take reasonable steps to reverse collection actions.</div>";
  html += "<h3>Other help to check</h3><ul class='list'>" + r.otherPrograms.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
  html += "<div class='row-actions'>" + planButton("planBill") + "<button class='ghost' id='billToFight'>Bill looks wrong, or in collections? Fight a bill</button></div>";
  $("results").innerHTML = html;
  wirePlanButton("planBill", function () {
    var dls = [];
    if (dl) dls.push({ label: "Apply for financial assistance at " + (a.hospitalName || "the hospital") + " by", date: dl.applyBy });
    if (r.planAhead && a.scheduledDate) dls.push({ label: "Procedure date (apply before this)", date: a.scheduledDate });
    return { kind: "Hospital bill", title: "Financial assistance: " + (a.hospitalName || "hospital bill"), summary: verdict(r) + (a.billAmount ? " on a " + money(+a.billAmount) + " bill." : "."),
      steps: r.planAhead ? r.planAhead.steps : ["Ask billing for the financial assistance application (or download it from the hospital's website).", "Fill it out and attach the documents below.", "Get a receipt or confirmation when you turn it in.", "Call after 2 weeks if you haven't heard back."],
      deadlines: dls, docs: r.documents };
  });
  $("billToFight").onclick = function () { showView("fight"); };
  $("results").insertAdjacentHTML("beforeend", helpfulBox("fbBill")); wireHelpful("fbBill", "Hospital bill");
}

function policyBlock(a, r) {
  var p = r.policy;
  if (p && p.source === "state") {
    var L = p.law;
    return "<h3>What " + esc(a.state) + " law guarantees</h3><p><b>" + esc(L.law) + "</b>" +
      (p.free ? ": free care up to " + p.free + "% of the poverty line" : "") + (p.discount ? (p.free ? ", " : ": ") + "discounts up to " + p.discount + "%" : "") + ". " +
      (L.appliesTo ? "Applies to: " + esc(L.appliesTo) + ". " : "") + (L.insuranceRule ? esc(L.insuranceRule) + ". " : "") +
      "Your hospital can be more generous. Ask for its policy.</p>" +
      ((L.otherKeyRules || []).length ? "<ul class='list'>" + L.otherKeyRules.slice(0, 4).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      "<p class='hint'>Checked " + esc(L.verified) + " · " + (L.sources || []).slice(0, 2).map(function (u, i) { return "<a href='" + esc(u) + "' target='_blank' rel='noopener'>source " + (i + 1) + "</a>"; }).join(", ") + "</p>";
  }
  if (p && p.source === "state-info") {
    var L2 = p.law;
    return "<h3>What " + esc(a.state) + " law says</h3><p><b>" + esc(L2.law) + "</b>. " + esc(p.why) + "</p>" +
      "<p>For how much free or discounted care you can get, check your hospital's own financial assistance policy (nonprofit hospitals must post it), or call billing.</p>" +
      "<p class='hint'>Checked " + esc(L2.verified) + " · " + (L2.sources || []).slice(0, 2).map(function (u, i) { return "<a href='" + esc(u) + "' target='_blank' rel='noopener'>source " + (i + 1) + "</a>"; }).join(", ") + "</p>";
  }
  if (p && p.known) {
    var K = p.known;
    return "<h3>What " + esc(K.system) + "'s financial assistance policy says</h3>" +
      (p.source === "hospital-info" ? "<p>" + esc(p.why) + "</p>" :
        "<p>" + (K.freeUpToPctFPL ? "Free care up to <b>" + K.freeUpToPctFPL + "%</b> of the poverty line" : "") + (K.discountUpToPctFPL ? (K.freeUpToPctFPL ? ", discounts up to <b>" : "Discounts up to <b>") + K.discountUpToPctFPL + "%</b>" : "") + ".</p>" +
        ((K.tiers || []).length ? "<ul class='list'>" + K.tiers.map(function (t) { return "<li>Up to " + t.upToPctFPL + "% of the poverty line: " + t.discountPct + "% off</li>"; }).join("") + "</ul>" : "")) +
      "<ul class='list'>" + [K.uninsuredOnly ? "For uninsured patients." : K.insuredEligible, K.assetTest ? "Savings and assets: " + K.assetTest : "", K.residencyRule ? "Where you live: " + K.residencyRule : "", K.catastrophicRule ? "Very large bills: " + K.catastrophicRule : ""]
        .filter(Boolean).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      "<p>" + (K.applyPhone ? "Call billing: <a href='tel:" + esc(K.applyPhone.replace(/[^0-9+]/g, "")) + "'>" + esc(K.applyPhone) + "</a>. " : "") + (K.applyUrl ? "<a href='" + esc(K.applyUrl) + "' target='_blank' rel='noopener'>Get the application</a>" : "") + "</p>" +
      "<p class='hint'>From the hospital's posted policy" + (K.effectiveDate ? " (effective " + esc(K.effectiveDate) + ")" : "") + ", checked " + esc(K.checked) + ". " +
      "<a href='" + esc(K.sourceUrl) + "' target='_blank' rel='noopener'>Read the policy</a>. Policies change. The hospital decides your application.</p>";
  }
  if (p && p.source === "hospital") return "<h3>Your hospital's policy</h3><p>Using the limits you entered: " + (p.free ? "free care up to " + p.free + "%" : "") + (p.discount ? (p.free ? ", " : "") + "discounts up to " + p.discount + "%" : "") + " of the poverty line.</p>";
  var hosp = a.hospitalName ? esc(a.hospitalName) : "your hospital";
  return "<h3>How much help you can get</h3><p>" + esc(a.state || "Your state") + " doesn't set a minimum by law (as far as our research found), so it depends on " + hosp + "'s own financial assistance policy. Many patients qualify for free or discounted care.</p>" +
    "<ol class='list'><li>Search the web for <b>\"" + hosp + " financial assistance policy\"</b>. Nonprofit hospitals must post it, along with a plain-language summary and the application.</li>" +
    "<li>Or call the hospital's billing office and ask: \"What income qualifies for free care, and for discounts?\"</li>" +
    "<li>Enter those limits above under \"Know your hospital's own assistance policy?\" for an exact answer.</li></ol>";
}

// ---------------------------------------------------------------- packet
function renderPacket() {
  var a = last.answers, r = last.result;
  var hosp = a.hospitalName || "[Hospital name]";
  var rows = [
    ["Patient", a.name || "[Name]"], ["Contact", a.contact || "[Phone / email]"],
    ["Hospital account number", a.account || "[Account number]"], ["Amount billed", money(a.billAmount)],
    a.timing === "before" ? ["Scheduled procedure date", a.scheduledDate || "[Date]"] : ["Date of first bill", a.firstBillDate || "[Date]"], ["Household size", a.householdSize],
    ["Annual household income", money(r.income)], ["Income as % of " + NAV_CONFIG.FPL.year + " federal poverty guideline", r.pct + "%"],
    ["Insurance", { none: "Uninsured", private: "Private", medicare: "Medicare", medicaid: "Medicaid" }[a.insurance]]
  ];
  $("packet").innerHTML =
    "<h2 class='no-print'>Your application packet</h2>" +
    "<p class='hint no-print'>Print this and attach it to the hospital's own financial assistance form. The hospital's form is required. This packet makes it faster to fill out and harder to lose.</p>" +
    "<div class='letter card'>" +
    "<p>" + esc(todayStr()) + "</p>" +
    "<p>Financial Assistance / Patient Financial Services<br>" + esc(hosp) + "</p>" +
    "<p><b>Re: Application for financial assistance, account " + esc(a.account || "[number]") + "</b></p>" +
    "<p>I am applying for financial assistance under " + esc(hosp) + "'s Financial Assistance Policy " +
    (a.timing === "before" ? "in advance of a scheduled procedure" + (a.scheduledDate ? " on " + esc(a.scheduledDate) : "") + ", and I ask that you let me know whether you can review it before the procedure." : "for the bill listed below.") + " My household of " + a.householdSize +
    " has an annual income of " + money(r.income) + ", which is " + r.pct + "% of the " + NAV_CONFIG.FPL.year + " federal poverty guideline. I have attached the documents listed below.</p>" +
    (a.timing === "before" ? "<p>Please send me a written decision" : "<p>Please hold any collection activity on this account while my application is reviewed") + (a.inCollections ? ". This account has already been referred to collections, and I ask that those actions be suspended while my application is pending" : "") +
    (a.timing === "before" ? ", and an estimate of what I would owe after assistance.</p>" : ". Please send me a written decision.</p>") +
    "<table>" + rows.map(function (x) { return "<tr><td>" + esc(x[0]) + "</td><td>" + esc(x[1]) + "</td></tr>"; }).join("") + "</table>" +
    "<p><b>Documents attached</b></p><ul class='list'>" + r.documents.map(function (d) { return "<li>☐ " + esc(d) + "</li>"; }).join("") + "</ul>" +
    "<p>Thank you,<br><br>______________________________<br>" + esc(a.name || "[Name]") + "</p></div>";
}

// ---------------------------------------------------------------- tracking
function loadCases() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch (e) { return []; } }
function saveCases(c) { localStorage.setItem(STORE, JSON.stringify(c)); }

$("saveCase").onclick = function () {
  var cases = loadCases();
  cases.push({ id: Date.now(), saved: todayStr(), status: "Screened", answers: last.answers, result: last.result });
  saveCases(cases);
  alert("Saved. Open the Hospital dashboard tab to see it.");
};

// Was-this-helpful totals from this device (for the deployment log). No personal details are stored.
function renderFeedback() {
  var box = $("feedbackStats"); if (!box || typeof Feedback === "undefined") return;
  var s = Feedback.summary(), areas = Object.keys(s);
  box.innerHTML = "<h2>Was this helpful? <span class='hint'>(answers on this device)</span></h2>" +
    (areas.length ? "<table><thead><tr><th>Where</th><th>Yes</th><th>No</th><th>% yes</th><th>Reasons for no</th></tr></thead><tbody>" + areas.map(function (a) {
      var x = s[a], n = x.yes + x.no;
      return "<tr><td>" + esc(a) + "</td><td>" + x.yes + "</td><td>" + x.no + "</td><td>" + Math.round(100 * x.yes / n) + "%</td><td>" +
        Object.keys(x.reasons).map(function (r) { return esc(r) + " (" + x.reasons[r] + ")"; }).join(", ") + "</td></tr>";
    }).join("") + "</tbody></table>" : "<p class='hint'>No answers yet.</p>") +
    "<p><button class='ghost' id='fbExport'>Download as CSV</button> <button class='ghost' id='fbClear'>Clear these answers</button></p>";
  $("fbExport").onclick = function () {
    var rows = [["date", "where", "helpful", "reason"]].concat(Feedback.all().map(function (f) { return [f.date, f.area, f.helpful ? "yes" : "no", f.reason]; }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(","); }).join("\n")], { type: "text/csv" }));
    a.download = "was-this-helpful.csv"; document.body.appendChild(a); a.click(); a.remove();
  };
  $("fbClear").onclick = function () { if (confirm("Clear all was-this-helpful answers on this device?")) { Feedback.clear(); renderFeedback(); } };
}

function renderDashboard() {
  renderFeedback();
  var cases = loadCases();
  var open = cases.filter(function (c) { return ["Approved", "Denied"].indexOf(c.status) < 0; });
  var approved = cases.filter(function (c) { return c.status === "Approved"; });
  var soon = open.filter(function (c) { return c.result.deadlines && c.result.deadlines.daysLeft <= 30; });
  var kpi = function (k, v) { return "<div class='stat'><div class='k'>" + k + "</div><div class='v'>" + v + "</div></div>"; };
  $("kpis").innerHTML = kpi("Applications", cases.length) + kpi("Open", open.length) + kpi("Deadline in 30 days", soon.length) +
    kpi("Approved write-offs", money(approved.reduce(function (s, c) { return s + c.result.estimatedSavings; }, 0)));
  var tb = document.querySelector("#cases tbody");
  if (!cases.length) { tb.innerHTML = "<tr><td colspan='7' class='hint'>No applications yet. Complete the Patient flow and press Save.</td></tr>"; return; }
  tb.innerHTML = cases.map(function (c) {
    var dl = c.result.deadlines;
    return "<tr><td>" + esc(c.answers.name || "Unnamed") + "<div class='hint'>" + esc(c.answers.hospitalName) + "</div></td>" +
      "<td>" + money(c.answers.billAmount) + "</td><td>" + c.result.pct + "%</td><td>" + esc(verdict(c.result)) + "</td>" +
      "<td>" + (dl ? dl.applyBy : "—") + "</td>" +
      "<td><select data-id='" + c.id + "'>" + STATUSES.map(function (s) { return "<option" + (s === c.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></td>" +
      "<td><button class='x' data-del='" + c.id + "' title='Delete'>×</button></td></tr>";
  }).join("");
  tb.querySelectorAll("select").forEach(function (s) {
    s.onchange = function () { var cs = loadCases(); cs.forEach(function (c) { if (c.id == s.dataset.id) c.status = s.value; }); saveCases(cs); renderDashboard(); };
  });
  tb.querySelectorAll("[data-del]").forEach(function (b) {
    b.onclick = function () { saveCases(loadCases().filter(function (c) { return c.id != b.dataset.del; })); renderDashboard(); };
  });
}

// Deep link to a tab, e.g. index.html#patient
// Deep links like index.html#plan. Wait until every tab's script has loaded.
window.addEventListener("load", function () {
  if (location.hash) { var deep = document.querySelector('.tab[data-view="' + location.hash.slice(1) + '"]'); if (deep) deep.click(); }
});

$("clearData").onclick = function () {
  if (!confirm("Delete all saved applications from this browser?")) return;
  try { localStorage.removeItem(STORE); localStorage.removeItem("nav501r.cases"); } catch (e) {}
  renderDashboard();
};
