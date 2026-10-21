// Pure screening logic. No page code here, so it can be tested on its own.

var NavLogic = (function () {
  var PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, annual: 1 };

  function povertyLine(size, cfg) {
    if (!(size >= 1)) throw new Error("household size must be at least 1");
    return cfg.FPL.base + cfg.FPL.perAdditional * (Math.floor(size) - 1);
  }

  function annualize(amount, freq) {
    if (!PER_YEAR[freq]) throw new Error("unknown pay frequency: " + freq);
    return (Number(amount) || 0) * PER_YEAR[freq];
  }

  function householdIncome(sources) {
    return (sources || []).reduce(function (sum, s) { return sum + annualize(s.amount, s.freq); }, 0);
  }

  function percentOfPoverty(income, size, cfg) {
    return Math.round((income / povertyLine(size, cfg)) * 100);
  }

  function policyTier(pct, policy) {
    var tiers = policy.tiers.slice().sort(function (a, b) { return a.maxPct - b.maxPct; });
    for (var i = 0; i < tiers.length; i++) if (pct <= tiers[i].maxPct) return tiers[i];
    return null;
  }

  // Does 501(r) reach this bill at all?
  function coverage(hospitalType, careType) {
    if (careType === "private-practice")
      return { status: "no", why: "501(r) only covers hospital bills. Bills from a doctor's own private practice are not included." };
    if (careType === "prescription")
      return { status: "no", why: "Pharmacy bills are not covered by 501(r). Check the drug manufacturer's patient assistance program instead." };
    var physician = careType === "physician";
    var note = physician ? " A separate doctor bill is only covered if that doctor is on the hospital's FAP provider list." : "";
    if (hospitalType === "nonprofit")
      return { status: physician ? "check" : "yes", why: "Nonprofit (501(c)(3)) hospitals must have a financial assistance policy under 501(r)." + note };
    if (hospitalType === "forprofit")
      return { status: "no", why: "For-profit hospitals are not bound by 501(r). Many still have a charity policy, so ask the billing office." };
    if (hospitalType === "government")
      return { status: "check", why: "501(r) applies only if the public hospital also holds 501(c)(3) status. Most public hospitals run their own assistance program, so ask billing." + note };
    return { status: "check", why: "Look up the hospital in the IRS Tax Exempt Organization Search (apps.irs.gov/app/eos). If it is listed as 501(c)(3), 501(r) applies." + note };
  }

  // Dates are 'YYYY-MM-DD'. Done in UTC so time zones don't shift the day.
  function parseDay(s) {
    var p = String(s).split("-").map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function fmtDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
  var DAY = 86400000;

  function deadlines(firstBillDate, todayStr, rules) {
    var first = parseDay(firstBillDate), today = parseDay(todayStr);
    if (first === null || today === null) return null;
    var applyBy = first + rules.applicationWindowDays * DAY;
    var ecaFrom = first + rules.noEcaBeforeDays * DAY;
    return {
      applyBy: fmtDay(applyBy),
      daysLeft: Math.round((applyBy - today) / DAY),
      collectionsAllowedFrom: fmtDay(ecaFrom),
      collectionsPossible: today >= ecaFrom
    };
  }

  function documents(a) {
    var d = ["Photo ID", "Every bill or statement from the hospital (with account number)", "Proof of address (lease, utility bill)"];
    var kinds = (a.incomeSources || []).map(function (s) { return s.kind; });
    if (kinds.indexOf("wages") >= 0) d.push("Recent pay stubs for every working household member (check the hospital form for how many months)");
    if (kinds.indexOf("self") >= 0) d.push("Most recent federal tax return, including Schedule C");
    if (kinds.indexOf("benefits") >= 0) d.push("Benefit award letters (Social Security, unemployment, disability)");
    if (!kinds.length || householdIncome(a.incomeSources) === 0) d.push("Signed statement explaining no income and who supports you");
    if (a.insurance === "private" || a.insurance === "medicare" || a.insurance === "medicaid") d.push("Insurance card and the Explanation of Benefits for this visit");
    if (a.insurance === "none") d.push("Medicaid decision letter, if you have one (some hospitals ask you to apply for Medicaid first)");
    if (a.inCollections) d.push("Any collection agency letters");
    if (a.householdSize > 1) d.push("Names and birth dates of everyone in your household");
    return d;
  }

  function otherPrograms(a, pct) {
    var p = [];
    if (a.careType === "prescription" || a.hasRxCosts)
      p.push("Drug manufacturer patient assistance program: most expensive brand-name drugs have one, with its own income limit.");
    if (a.insurance === "none")
      p.push("Medicaid: limits vary a lot by state. Screen at healthcare.gov or your state Medicaid site. In many states Medicaid can also cover bills from up to 3 months back.");
    if (a.insurance === "medicare")
      p.push("Medicare Savings Program: your state may pay Medicare premiums and cost-sharing if you have limited income.");
    p.push("Hospital payment plan: if you only qualify for a partial discount, ask for an interest-free plan on the remaining balance.");
    return p;
  }

  // Scheduled (non-emergency) care: apply before the procedure.
  // 501(r) only REQUIRES hospitals to accept applications from the date care is provided;
  // accepting them earlier is each hospital's choice, so the advice says to ask.
  function planAhead(a, todayStr) {
    var steps = [
      "Call the hospital's financial assistance office now and ask: \"Can I apply before my procedure?\" Many hospitals allow it, but 501(r) doesn't require it.",
      "Ask for a written estimate of the full cost, including anesthesia, the facility fee, and any doctors who bill separately.",
      "Ask how long an approval lasts, so follow-up visits are covered too.",
      "Ask which doctors at the hospital are covered by its assistance policy. Separate doctor bills may not be included.",
      "Bring your approval letter, or proof you applied, to your pre-surgery appointment."
    ];
    var daysUntil = null;
    var s = parseDay(a.scheduledDate), t = parseDay(todayStr);
    if (s !== null && t !== null) daysUntil = Math.round((s - t) / DAY);
    return { steps: steps, daysUntil: daysUntil };
  }

  // Where the discount rules come from: the hospital's own policy if the person entered it,
  // otherwise the state's charity-care law, otherwise nothing (we never invent tiers).
  function policyFor(a, today) {
    var hf = num(a.hospFree), hd = num(a.hospDiscount);
    if (hf !== null || hd !== null) return { source: "hospital", free: hf, discount: hd, label: "your hospital's policy (as entered)" };
    // A policy we've looked up for this hospital (hospital-policies.js), from the hospital's own posted document.
    // hospPolicyId is the hospital's CMS number. Some hospitals have a separate version for uninsured and insured patients.
    var ids = a.hospPolicyId && typeof HOSPITAL_POLICIES !== "undefined" ? HOSPITAL_POLICIES.byCcn[a.hospPolicyId] || [] : [];
    var uninsured = !a.insurance || a.insurance === "none";
    var cands = ids.map(function (id) { return HOSPITAL_POLICIES.policies[id]; });
    // Some hospitals run one program for local residents and another for everyone else.
    var area = cands.filter(function (x) { return x.residencyArea; })[0];
    if (area) {
      if (a.inArea !== true && a.inArea !== false)
        return { source: "hospital-info", free: null, discount: null, label: area.system + " financial assistance policy", known: area,
          why: "This hospital has one program for people who live in " + area.residencyArea + " and another for everyone else. Answer the question under the hospital name to see yours." };
      cands = cands.filter(function (x) { return x.residencyVariant === (a.inArea ? "resident" : "nonresident"); });
    }
    var known = cands.sort(function (x, y) { return (!!y.uninsuredOnly === uninsured) - (!!x.uninsuredOnly === uninsured); })[0] || null;
    if (known) {
      var hwhy = null;
      if (known.uninsuredOnly && a.insurance && a.insurance !== "none") hwhy = "This hospital's policy covers uninsured patients only. Ask billing whether insured patients with large bills can still apply.";
      else if (!known.freeUpToPctFPL && !known.discountUpToPctFPL) hwhy = known.notes || "This policy doesn't use income levels we can check here.";
      if (hwhy) return { source: "hospital-info", free: null, discount: null, label: known.system + " financial assistance policy", known: known, why: hwhy };
      return { source: "hospital", free: known.freeUpToPctFPL || null, discount: known.discountUpToPctFPL || null, tiers: known.tiers || [], label: known.system + " financial assistance policy", known: known };
    }
    var law = typeof STATE_LAWS !== "undefined" && a.state ? STATE_LAWS[a.state] : null;
    if (!law) return null;
    // A state law exists. Use its tiers only where they actually apply to this patient and hospital.
    var why = null;
    if (!law.freeCareUpToPctFPL && !law.discountUpToPctFPL) why = law.protection || "This law isn't a free-care or discount schedule.";
    else if (law.tiersFrom && (today || "") < law.tiersFrom) why = "These discount tiers start for care on or after " + new Date(law.tiersFrom + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) + ". Until then, your hospital's own policy applies.";
    else if (law.uninsuredOnly && a.insurance && a.insurance !== "none") why = "This law covers uninsured patients only.";
    else if (law.nonprofitOnly && a.hospitalType && a.hospitalType !== "nonprofit" && a.hospitalType !== "unsure") why = "This law covers nonprofit hospitals only.";
    if (why) return { source: "state-info", free: null, discount: null, label: a.state + " law: " + law.law, law: law, why: why };
    return { source: "state", free: law.freeCareUpToPctFPL || null, discount: law.discountUpToPctFPL || null, label: a.state + " law: " + law.law, law: law };
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) || n <= 0 ? null : n; }

  function screen(a, cfg, today) {
    var out = { warnings: [] };
    if (cfg.FPL.unsupportedStates.indexOf(a.state) >= 0)
      out.warnings.push(a.state + " uses its own poverty table, which is not loaded. These results understate eligibility.");
    out.income = householdIncome(a.incomeSources);
    out.povertyLine = povertyLine(a.householdSize, cfg);
    out.pct = percentOfPoverty(out.income, a.householdSize, cfg);
    out.coverage = coverage(a.hospitalType, a.careType);
    out.policy = policyFor(a, today);
    out.tier = null; out.estimatedSavings = 0;
    if (out.policy && /-info$/.test(out.policy.source)) { /* rule noted, but no tiers apply */ }
    else if (out.coverage.status !== "no" || (out.policy && out.policy.source === "state")) {
      if (out.policy && out.policy.free !== null && out.pct <= out.policy.free) { out.tier = { label: "Free care", discount: 100 }; }
      else if (out.policy && out.policy.discount !== null && out.pct <= out.policy.discount) {
        // A sliding scale from the hospital's policy gives a real percentage; otherwise the amount varies.
        var t = (out.policy.tiers || []).filter(function (x) { return out.pct <= x.upToPctFPL && x.discountPct > 0; }).sort(function (x, y) { return x.upToPctFPL - y.upToPctFPL; })[0];
        out.tier = { label: "Discounted care", discount: t ? t.discountPct : null };
      }
      else if (out.policy) { out.tier = { label: "Above the " + (out.policy.source === "state" ? "state's" : "hospital's") + " income limit", discount: 0, above: true }; }
      if (out.tier && out.tier.discount) out.estimatedSavings = Math.round((Number(a.billAmount) || 0) * out.tier.discount / 100);
    }
    out.deadlines = a.timing !== "before" && a.firstBillDate ? deadlines(a.firstBillDate, today, cfg.RULES_501R) : null;
    out.planAhead = a.timing === "before" ? planAhead(a, today) : null;
    if (out.deadlines && out.deadlines.daysLeft < 0)
      out.warnings.push("The 240-day minimum window has passed. Apply anyway: many hospitals accept late applications, and 501(r) is only the minimum.");
    out.documents = documents(a);
    out.otherPrograms = otherPrograms(a, out.pct);
    return out;
  }

  return { povertyLine: povertyLine, annualize: annualize, householdIncome: householdIncome,
    percentOfPoverty: percentOfPoverty, policyTier: policyTier, policyFor: policyFor, coverage: coverage,
    deadlines: deadlines, planAhead: planAhead, documents: documents, otherPrograms: otherPrograms, screen: screen };
})();

if (typeof module !== "undefined") module.exports = NavLogic;
