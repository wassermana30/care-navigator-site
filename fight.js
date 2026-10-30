// Fight a bill: pick your situation, see your rights (from FIGHT_FACTS, each from an official page),
// check the numbers that matter, and get a letter you can edit, print or save.

var FightLogic = (function () {
  function days(a, b) { var x = Date.parse(a + "T12:00:00"), y = Date.parse(b + "T12:00:00"); return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 86400000); }
  function addDays(d, n) { var t = Date.parse(d + "T12:00:00"); return isNaN(t) ? null : new Date(t + n * 86400000).toISOString().slice(0, 10); }
  // Uninsured / self-pay dispute: bill at least $400 over the Good Faith Estimate, started within 120 days of the first bill.
  function gfeDispute(estimate, billed, billDate, today, F) {
    var n = F.numbers, over = billed - estimate, threshold = +n.threshold_usd, limit = +n.deadline_days_from_initial_bill;
    var since = billDate ? days(billDate, today) : null;
    return { over: over, threshold: threshold, enoughOver: over >= threshold, deadline: billDate ? addDays(billDate, limit) : null,
      daysLeft: since === null ? null : limit - since, inTime: since === null ? null : since <= limit, fee: +n.fee_usd };
  }
  // Nonprofit hospital collection timeline from the first bill after discharge.
  function timeline(firstBill, today, F) {
    var n = F.numbers;
    return { noHarshStepsBefore: addDays(firstBill, +n.notification_period_days), applyBy: addDays(firstBill, +n.application_period_days),
      daysToApply: days(today, addDays(firstBill, +n.application_period_days)), harshStepsAllowedNow: days(firstBill, today) >= +n.notification_period_days };
  }
  return { gfeDispute: gfeDispute, timeline: timeline, addDays: addDays, days: days };
})();

if (typeof document !== "undefined") (function () {
  var view = document.getElementById("view-fight");
  if (!view) return;
  var F = {}; FIGHT_FACTS.facts.forEach(function (f) { F[f.id] = f; });
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function today() { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }
  function money(n) { return "$" + Math.round(n).toLocaleString(); }

  function fact(id) {
    var f = F[id]; if (!f) return "";
    var flag = f.status === "changed" ? "<span class='pill maybe'>Changed recently</span> " : f.status === "uncertain" ? "<span class='pill maybe'>Not settled</span> " : "";
    return "<div class='card'><div class='hint'>" + esc(f.topic) + "</div><p>" + flag + esc(f.plain) + "</p>" +
      ((f.details || []).length ? "<ul class='list'>" + f.details.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" : "") +
      (f.statusNote && f.status !== "current" ? "<p class='hint'>" + esc(f.statusNote) + "</p>" : "") +
      "<p>" + (f.phone ? "<a href='tel:" + esc(f.phone.replace(/[^0-9]/g, "")) + "'>" + esc(f.phone) + "</a> · " : "") +
      "<a href='" + esc(f.url) + "' target='_blank' rel='noopener'>Official page</a> <span class='hint'>· checked " + esc(FIGHT_FACTS.checked) + "</span></p></div>";
  }

  var SITUATIONS = [
    { id: "wrong", title: "My bill looks wrong", sub: "Charges I don't recognize, or I can't tell what I'm paying for",
      facts: ["billing-records-right", "billing-records-timeline", "bill-errors"], letter: "itemized" },
    { id: "estimate", title: "I'm uninsured and the bill is much higher than my estimate", sub: "Or I paid myself, without insurance",
      facts: ["gfe-uninsured", "ppdr-dispute", "ppdr-collections-pause"], letter: "gfe", calc: "gfe" },
    { id: "surprise", title: "A surprise out-of-network bill", sub: "I have insurance, but got billed by someone I didn't choose",
      facts: ["nsa-protections", "nsa-what-you-owe", "nsa-exceptions", "nsa-complaint"], letter: "surprise" },
    { id: "collections", title: "It's in collections, or they're threatening it", sub: "Calls, letters, credit report, lawsuit",
      facts: ["501r-timeline", "501r-ecas", "501r-stop-and-refund", "pause-collections-while-applying", "credit-bureau-policies", "cfpb-medical-debt-rule", "state-medical-debt-credit-bans", "501r-irs-complaint"], letter: "collections", calc: "timeline" },
    { id: "afford", title: "I just can't afford it", sub: "I need it lowered or spread out",
      facts: ["negotiate-and-payment-plans"], letter: "plan" }
  ];

  var LETTERS = {
    itemized: { title: "Request for an itemized bill and billing records", body: function (d) {
      return "I am writing about account number " + d.acct + " for care on " + d.dos + ".\n\n" +
        "Please send me a complete itemized bill showing each charge, with its date, billing code (CPT/HCPCS or revenue code) and description. " +
        "I am also requesting a copy of my billing records under my HIPAA right of access.\n\n" +
        "Please do not send this account to collections while I review the charges. I can be reached at " + d.contact + ".";
    } },
    gfe: { title: "Bill is more than my Good Faith Estimate", body: function (d) {
      return "I am writing about account number " + d.acct + " for care on " + d.dos + ".\n\n" +
        "I was uninsured (or self-pay) and received a Good Faith Estimate of " + d.est + ". The bill I received is " + d.amt + ", which is " + d.over + " more than the estimate.\n\n" +
        "I am asking you to correct the bill to match the estimate. If you do not, I plan to start the federal patient-provider dispute resolution process. " +
        "Please do not send this bill to collections or add late fees while this is being resolved. I can be reached at " + d.contact + ".";
    } },
    surprise: { title: "Surprise bill protected by the No Surprises Act", body: function (d) {
      return "I am writing about account number " + d.acct + " for care on " + d.dos + ".\n\n" +
        "I believe this bill is protected by the federal No Surprises Act. I should only owe my in-network cost-sharing (copay, coinsurance or deductible). " +
        "Please correct the bill, or explain in writing why the protection does not apply.\n\n" +
        "I did not agree in writing to give up these protections. I can be reached at " + d.contact + ".";
    } },
    collections: { title: "I have applied for financial assistance: please pause collections", body: function (d) {
      return "I am writing about account number " + d.acct + " for care on " + d.dos + ".\n\n" +
        "I have applied (or am applying) for financial assistance under your financial assistance policy. " +
        "Under the IRS 501(r) rules for nonprofit hospitals, please pause all extraordinary collection actions on this account, including credit reporting, while my application is reviewed. " +
        "If I qualify, please refund any amount I overpaid and reverse any collection actions already taken.\n\n" +
        "Please confirm in writing that you received this letter. I can be reached at " + d.contact + ".";
    } },
    plan: { title: "Request for a lower bill or a payment plan", body: function (d) {
      return "I am writing about account number " + d.acct + " for care on " + d.dos + ", balance " + d.amt + ".\n\n" +
        "I cannot pay this amount all at once. Please tell me whether I qualify for your financial assistance policy, any discount for paying myself, or a prompt-pay discount. " +
        "If not, I am asking for an interest-free payment plan of " + d.monthly + " per month.\n\n" +
        "Please do not send this account to collections while we work this out. I can be reached at " + d.contact + ".";
    } }
  };

  view.innerHTML = "<section class='tool-intro'><h2>Fight a bill</h2><p>Pick what's going on. You'll see your rights, from official sources, and a letter you can send.</p></section>" +
    "<div class='choice-cards' id='fbChoices'>" + SITUATIONS.map(function (s) { return "<button data-s='" + s.id + "'><b>" + esc(s.title) + "</b><span class='hint'>" + esc(s.sub) + "</span></button>"; }).join("") + "</div>" +
    "<div id='fbOut'></div>";

  function render(sid) {
    var s = SITUATIONS.filter(function (x) { return x.id === sid; })[0];
    document.querySelectorAll("#fbChoices button").forEach(function (b) { b.classList.toggle("on", b.dataset.s === sid); });
    var L = LETTERS[s.letter];
    var html = "<h2>" + esc(s.title) + "</h2>";
    if (s.id === "afford" || s.id === "collections") html += "<div class='card'><b>First: apply for the hospital's financial assistance.</b> Many people qualify for free or discounted care, even after the bill. <button class='primary' id='fbTo501r'>Check what I'd qualify for</button></div>";
    html += "<div class='card'><h3>Your details</h3><p class='hint'>Used only to fill in the letter. Nothing leaves this page.</p><div class='grid'>" +
      "<label>Hospital or provider<input id='fbProv' placeholder='e.g. Memorial Hospital'></label><label>Account number<input id='fbAcct'></label>" +
      "<label>Date of care<input id='fbDos' type='date'></label><label>Date of the first bill<input id='fbBillDate' type='date'></label>" +
      "<label>Amount billed ($)<input id='fbAmt' type='number' min='0'></label>" +
      (s.calc === "gfe" ? "<label>Good Faith Estimate amount ($)<input id='fbEst' type='number' min='0'></label>" : "") +
      (s.id === "afford" ? "<label>Monthly payment you can afford ($)<input id='fbMonthly' type='number' min='0'></label>" : "") +
      "<label>Your name (optional)<input id='fbName'></label><label>Phone or email for replies (optional)<input id='fbContact'></label></div>" +
      "<div class='row-actions'><button class='primary' id='fbMake'>Check and write my letter</button></div></div><div id='fbCalc'></div><div id='fbLetter'></div>" +
      "<h3>Your rights</h3>" + s.facts.map(fact).join("") +
      "<p class='hint'>This is general information from official sources, not legal advice. For help, a local legal aid office is free if you qualify.</p>";
    document.getElementById("fbOut").innerHTML = html;
    var t5 = document.getElementById("fbTo501r"); if (t5) t5.onclick = function () { showView("patient"); };
    document.getElementById("fbMake").onclick = function () {
      var amt = +val("fbAmt") || 0, calc = "", ok = true;
      if (s.calc === "gfe") {
        if (!val("fbEst") || !amt) { document.getElementById("fbCalc").innerHTML = "<p class='warn'>Enter the estimate and the amount billed.</p>"; return; }
        var g = FightLogic.gfeDispute(+val("fbEst"), amt, val("fbBillDate"), today(), F["ppdr-dispute"]);
        ok = g.enoughOver;
        calc = "<div class='card prog " + (g.enoughOver && g.inTime !== false ? "likely" : "no") + "'><h3>" + (g.enoughOver ? "You can likely dispute this bill" : "Under the $" + g.threshold + " limit") + "</h3>" +
          "<p>The bill is <b>" + money(g.over) + "</b> over the estimate. Disputes need at least $" + g.threshold + ".</p>" +
          (g.deadline ? "<p>Start the dispute by <b>" + g.deadline + "</b>" + (g.daysLeft !== null ? " (" + (g.daysLeft >= 0 ? g.daysLeft + " days left" : "that was " + Math.abs(g.daysLeft) + " days ago") + ")" : "") + ". It costs $" + g.fee + ", and you get it back off the bill if you win.</p>" : "<p class='hint'>Add the date of the first bill to see your deadline.</p>") + "</div>";
      }
      if (s.calc === "timeline" && val("fbBillDate")) {
        var tl = FightLogic.timeline(val("fbBillDate"), today(), F["501r-timeline"]);
        calc = "<div class='card'><h3>Your dates (nonprofit hospitals)</h3><ul class='list'>" +
          "<li>No harsh collection steps before <b>" + tl.noHarshStepsBefore + "</b>" + (tl.harshStepsAllowedNow ? " (that date has passed)" : "") + ".</li>" +
          "<li>You can apply for financial assistance until at least <b>" + tl.applyBy + "</b>" + (tl.daysToApply >= 0 ? " (" + tl.daysToApply + " days left)" : " (passed, but apply anyway: many hospitals accept late applications)") + ".</li></ul></div>";
      }
      document.getElementById("fbCalc").innerHTML = calc;
      var dd = { acct: val("fbAcct") || "[account number]", dos: val("fbDos") || "[date of care]", amt: amt ? money(amt) : "[amount]", est: val("fbEst") ? money(+val("fbEst")) : "[estimate]",
        over: val("fbEst") ? money(amt - +val("fbEst")) : "[amount]", monthly: val("fbMonthly") ? money(+val("fbMonthly")) : "[amount]", contact: val("fbContact") || "[phone or email]" };
      var text = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + "\n\nTo: Billing Office, " + (val("fbProv") || "[hospital or provider]") +
        "\nRe: " + L.title + "\n\n" + L.body(dd) + "\n\nThank you,\n" + (val("fbName") || "[your name]");
      document.getElementById("fbLetter").innerHTML = "<div class='card'><h3>Your letter <span class='hint'>(edit anything before you send it)</span></h3>" +
        "<textarea id='fbText' class='letter' rows='16' style='width:100%'>" + esc(text) + "</textarea>" +
        "<p class='hint'>Send it by mail or the hospital's patient portal, and keep a copy. Sending by certified mail gives you proof it arrived.</p>" +
        "<div class='row-actions'><button class='ghost' id='fbCopy'>Copy</button><button class='ghost' id='fbPrint'>Print</button>" + planButton("planFight") + "</div></div>" + helpfulBox("fbFightH");
      wireHelpful("fbFightH", "Fight a bill");
      document.getElementById("fbCopy").onclick = function () { var t = document.getElementById("fbText"); t.select(); try { document.execCommand("copy"); this.textContent = "Copied"; } catch (e) {} };
      document.getElementById("fbPrint").onclick = function () {
        var w = window.open("", "_blank"); if (!w) return;
        w.document.write("<pre style='font:15px/1.5 Georgia,serif;white-space:pre-wrap;max-width:680px;margin:40px auto'>" + esc(document.getElementById("fbText").value) + "</pre>"); w.document.close(); w.print();
      };
      wirePlanButton("planFight", function () {
        var dls = [];
        if (s.calc === "gfe" && val("fbBillDate")) dls.push({ label: "Last day to start the bill dispute", date: FightLogic.addDays(val("fbBillDate"), +F["ppdr-dispute"].numbers.deadline_days_from_initial_bill) });
        if (s.calc === "timeline" && val("fbBillDate")) dls.push({ label: "Apply for financial assistance by", date: FightLogic.addDays(val("fbBillDate"), +F["501r-timeline"].numbers.application_period_days) });
        return { kind: "Fight a bill", title: s.title + (val("fbProv") ? " (" + val("fbProv") + ")" : ""), summary: L.title + ". Letter written " + today() + ".",
          steps: ["Send the letter and keep a copy.", "Write down every call: date, name, and what they said.", "Follow up if you don't hear back in 30 days."], deadlines: dls };
      });
    };
  }
  document.querySelectorAll("#fbChoices button").forEach(function (b) { b.onclick = function () { render(b.dataset.s); document.dispatchEvent(new CustomEvent("tabchange", { detail: "fight" })); }; });
  // For Undo / Clear (tabtools.js)
  window.FightUI = {
    open: function (sid) { showView("fight"); render(sid); },
    situationFor: function (factId) { var s = SITUATIONS.filter(function (x) { return x.facts.indexOf(factId) >= 0; })[0]; return s ? s.id : null; },
    current: function () { var b = document.querySelector("#fbChoices button.on"); return b ? b.dataset.s : null; },
    render: render,
    reset: function () { document.getElementById("fbOut").innerHTML = ""; document.querySelectorAll("#fbChoices button").forEach(function (b) { b.classList.remove("on"); }); }
  };
})();
