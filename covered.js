// Get covered: a quick check for Medicaid, CHIP, pregnancy coverage, Marketplace savings, and Medicare help.
// Rules come from COVERED_RULES (covered-data.js) and MEDICAID_STATES (programs.js), all from official sources.
// Near a limit we say "maybe", never "yes": states count income in ways we can't fully check here.

var CoveredLogic = (function () {
  var BAND = 5;  // Medicaid counts 5% of the poverty line off income ("disregard"), so treat +5 points as "maybe".
  function status(pct, limit) { return limit == null ? null : pct <= limit ? "likely" : pct <= limit + BAND ? "maybe" : "no"; }
  function pctFPL(income, size, cfg) { return Math.round(income / (cfg.FPL.base + cfg.FPL.perAdditional * Math.max(0, size - 1)) * 100); }

  // input: { state, size, income, kids (bool), pregnant (bool), medicare (bool), savings (number|null), status: "citizen"|"greencard"|"other"|"unsure", today }
  function check(input, cfg, R, M) {
    var es = input.lang === "es", t = function (en, sp) { return es ? sp : en; };
    var pct = pctFPL(input.income, input.size, cfg), st = input.state, out = [];
    var expansion = M.expansion[st] === true;
    var immNote = input.status === "greencard" ? t("Green card holders usually must wait 5 years for Medicaid. Many states cover children and pregnant people with no wait.",
        "Quienes tienen green card por lo general deben esperar 5 años para Medicaid. Muchos estados cubren a niños y embarazadas sin esperar.") :
      input.status === "other" ? t("Since October 1, 2026, federal Medicaid only covers citizens, green card holders, Cuban or Haitian entrants and COFA migrants. Some states pay for others themselves, and anyone can get emergency Medicaid in an emergency.",
        "Desde el 1 de octubre de 2026, el Medicaid federal solo cubre a ciudadanos, personas con green card, participantes cubanos o haitianos y migrantes COFA. Algunos estados pagan por otras personas, y cualquiera puede recibir Medicaid de emergencia en una emergencia.") : "";

    // Adults 19-64
    if (!input.medicare) {
      if (expansion) {
        var lim = R.medicaidAdults.expansionLimitPctFPL;
        out.push({ id: "medicaid-adult", name: t("Medicaid for adults", "Medicaid para adultos"), status: input.status === "other" ? "no" : status(pct, lim),
          why: t(pct + "% of the poverty line. " + st + " expanded Medicaid to adults up to " + lim + "%.", "Está al " + pct + "% del nivel de pobreza. " + st + " amplió Medicaid para adultos hasta el " + lim + "%.") + (immNote ? " " + immNote : ""),
          note: t("Starting January 1, 2027, adults 19 to 64 may need to show 80 hours a month of work, school, volunteering or a work program (or earn about $580 a month) unless they're exempt, and renew every 6 months.",
            "A partir del 1 de enero de 2027, los adultos de 19 a 64 años podrían tener que demostrar 80 horas al mes de trabajo, estudio, voluntariado o un programa de trabajo (o ganar unos $580 al mes), a menos que estén exentos, y renovar cada 6 meses.") });
      } else {
        var parentLimit = M.parents[st];
        if (input.kids && parentLimit != null) out.push({ id: "medicaid-parent", name: t("Medicaid for parents", "Medicaid para padres"), status: input.status === "other" ? "no" : status(pct, parentLimit),
          why: t(st + " didn't expand Medicaid. Parents can qualify up to about " + parentLimit + "% of the poverty line; you're at " + pct + "%.",
            st + " no amplió Medicaid. Los padres pueden calificar hasta más o menos el " + parentLimit + "% del nivel de pobreza; usted está al " + pct + "%.") + (immNote ? " " + immNote : "") });
        else if (pct < 100) out.push({ id: "gap", name: t("Medicaid for adults", "Medicaid para adultos"), status: "no",
          why: t(st + " didn't expand Medicaid, and adults without children usually can't get it there. Under 100% of the poverty line you also can't get Marketplace savings. This is called the coverage gap. A community health center can still see you based on income.",
            st + " no amplió Medicaid, y los adultos sin hijos por lo general no lo pueden recibir allí. Por debajo del 100% del nivel de pobreza tampoco puede recibir ahorros del Marketplace. Esto se llama la brecha de cobertura. Un centro de salud comunitario igual puede atenderle según sus ingresos.") });
        if (M.workStates.indexOf(st) >= 0 && st === "GA") out.push({ id: "ga-pathways", name: "Georgia Pathways", status: pct <= 100 ? "maybe" : "no",
          why: t("Georgia covers adults 19 to 64 up to 100% of the poverty line if they do 80 hours a month of work or other activities.",
            "Georgia cubre a adultos de 19 a 64 años hasta el 100% del nivel de pobreza si hacen 80 horas al mes de trabajo u otras actividades.") });
      }
    }
    // Children and pregnancy (CHIP / Medicaid)
    var ch = R.children[st];
    if (input.kids && ch) out.push({ id: "chip", name: t("Medicaid or CHIP for your children", "Medicaid o CHIP para sus hijos"), status: input.status === "other" ? "maybe" : status(pct, ch.limitPctFPL),
      why: t("Children in " + st + " can qualify up to about " + ch.limitPctFPL + "% of the poverty line; your household is at " + pct + "%.",
        "Los niños en " + st + " pueden calificar hasta más o menos el " + ch.limitPctFPL + "% del nivel de pobreza; su hogar está al " + pct + "%.") +
        (input.status === "other" ? t(" Many states cover lawfully residing children; ask your state Medicaid office.", " Muchos estados cubren a niños con residencia legal; pregunte en la oficina de Medicaid de su estado.") : ""),
      note: t("Limits are from the newest official 50-state table (" + (R.children.asOf || "2023") + "). Apply even if you're a little over.",
        "Los límites vienen de la tabla oficial más reciente de los 50 estados (" + (R.children.asOf || "2023") + "). Solicite aunque gane un poco más.") });
    var pg = R.pregnancy[st];
    if (input.pregnant && pg) out.push({ id: "pregnancy", name: t("Medicaid for pregnancy", "Medicaid para el embarazo"), status: R.uncertainPregnancy && R.uncertainPregnancy.indexOf(st) >= 0 ? "maybe" : status(pct, pg.limitPctFPL),
      why: t("Pregnant people in " + st + " can qualify up to about " + pg.limitPctFPL + "% of the poverty line; you're at " + pct + "%.",
        "Las embarazadas en " + st + " pueden calificar hasta más o menos el " + pg.limitPctFPL + "% del nivel de pobreza; usted está al " + pct + "%.") +
        (pg.postpartumMonths ? t(" Coverage lasts " + (pg.postpartumMonths === 12 ? "12 months" : pg.postpartumMonths + " months") + " after the baby is born.", " La cobertura dura " + pg.postpartumMonths + " meses después del parto.") : "") +
        (R.uncertainPregnancy && R.uncertainPregnancy.indexOf(st) >= 0 ? t(" This state's limit may have changed recently, so ask your state Medicaid office.", " El límite de este estado pudo haber cambiado hace poco; pregunte en la oficina de Medicaid de su estado.") : "") });
    // Marketplace
    if (!input.medicare) {
      var mk = R.marketplace, medicaidLikely = out.some(function (x) { return /medicaid-(adult|parent)/.test(x.id) && x.status === "likely"; });
      var mkStatus = input.status === "other" ? "maybe" : medicaidLikely ? "no" : pct >= mk.minPctFPL && (mk.maxPctFPL == null || pct <= mk.maxPctFPL) ? "likely" : "no";
      out.push({ id: "marketplace", name: t("Marketplace plan with lower premiums (HealthCare.gov)", "Plan del Marketplace con primas más bajas (HealthCare.gov)"), status: mkStatus,
        why: medicaidLikely ? t("You may get Medicaid instead, which usually costs less.", "Es posible que reciba Medicaid, que por lo general cuesta menos.") :
          pct < mk.minPctFPL ? t("Premium savings start at " + mk.minPctFPL + "% of the poverty line; you're at " + pct + "%.", "Los ahorros en la prima empiezan en el " + mk.minPctFPL + "% del nivel de pobreza; usted está al " + pct + "%.") :
          mk.maxPctFPL != null && pct > mk.maxPctFPL ? t("Above " + mk.maxPctFPL + "% of the poverty line there's no help with premiums in 2026 and 2027. You can still buy a plan.", "Por encima del " + mk.maxPctFPL + "% del nivel de pobreza no hay ayuda con las primas en 2026 y 2027. Igual puede comprar un plan.") :
          t("Between " + mk.minPctFPL + "% and " + mk.maxPctFPL + "% of the poverty line you may get a tax credit that lowers your monthly premium.", "Entre el " + mk.minPctFPL + "% y el " + mk.maxPctFPL + "% del nivel de pobreza podría recibir un crédito fiscal que baja su prima mensual."),
        note: t("Sign up for 2027 from November 1, 2026 to January 15, 2027 (by December 15 to start January 1). ", "Inscríbase para 2027 del 1 de noviembre de 2026 al 15 de enero de 2027 (antes del 15 de diciembre para empezar el 1 de enero). ") +
          (input.status === "other" ? t("Starting January 1, 2027, premium savings are limited to green card holders, Cuban or Haitian entrants and COFA migrants. Others can still buy a plan at full price.",
            "A partir del 1 de enero de 2027, los ahorros en la prima se limitan a personas con green card, participantes cubanos o haitianos y migrantes COFA. Los demás pueden comprar un plan a precio completo.") : ""),
        url: mk.url, phone: mk.phone });
    }
    // Medicare help
    if (input.medicare) {
      var eh = R.extraHelp, msp = R.msp, single = input.size <= 1, sv = input.savings;
      var ehRes = single ? eh.resourceLimitSingle : eh.resourceLimitMarried, mspRes = single ? msp.resourceLimitSingle : msp.resourceLimitMarried;
      var ehS = status(pct, eh.incomeLimitPctFPL); if (ehS !== "no" && sv != null && sv > ehRes) ehS = "no"; else if (ehS === "likely" && sv == null) ehS = "maybe";
      out.push({ id: "extra-help", name: t("Extra Help with Medicare drug costs", "Extra Help (Ayuda Adicional) con los costos de medicamentos de Medicare"), status: ehS,
        why: t("Income up to " + eh.incomeLimitPctFPL + "% of the poverty line and savings up to $" + ehRes.toLocaleString() + " (" + eh.year + "). You're at " + pct + "%" + (sv != null ? " with $" + sv.toLocaleString() + " in savings" : "") + ".",
          "Ingresos hasta el " + eh.incomeLimitPctFPL + "% del nivel de pobreza y ahorros hasta $" + ehRes.toLocaleString() + " (" + eh.year + "). Usted está al " + pct + "%" + (sv != null ? " con $" + sv.toLocaleString() + " en ahorros" : "") + "."), url: eh.url, phone: eh.phone });
      var level = pct <= msp.QMB.incomeLimitPctFPL ? "QMB" : pct <= msp.SLMB.incomeLimitPctFPL ? "SLMB" : pct <= msp.QI.incomeLimitPctFPL ? "QI" : null;
      var mS = level ? "likely" : status(pct, msp.QI.incomeLimitPctFPL); if (mS !== "no" && sv != null && sv > mspRes) mS = "maybe"; else if (mS === "likely" && sv == null) mS = "maybe";
      out.push({ id: "msp", name: t("Medicare Savings Program", "Programa de Ahorros de Medicare") + (level ? " (" + level + ")" : ""), status: mS,
        why: t("Pays your Medicare Part B premium" + (level === "QMB" ? ", plus deductibles and copays" : "") + ". Income limits are " + msp.QMB.incomeLimitPctFPL + "% (QMB), " + msp.SLMB.incomeLimitPctFPL + "% (SLMB) and " + msp.QI.incomeLimitPctFPL + "% (QI) of the poverty line; savings up to $" + mspRes.toLocaleString() + ". Some states are more generous.",
          "Paga su prima de la Parte B de Medicare" + (level === "QMB" ? ", además de deducibles y copagos" : "") + ". Los límites de ingresos son " + msp.QMB.incomeLimitPctFPL + "% (QMB), " + msp.SLMB.incomeLimitPctFPL + "% (SLMB) y " + msp.QI.incomeLimitPctFPL + "% (QI) del nivel de pobreza; ahorros hasta $" + mspRes.toLocaleString() + ". Algunos estados son más generosos."),
        note: t("Apply through your state Medicaid office.", "Solicite en la oficina de Medicaid de su estado.") });
    }
    var rank = { likely: 0, maybe: 1, no: 2 };
    var warn = cfg.FPL.unsupportedStates.indexOf(st) >= 0 ? t(st + " has a higher poverty line than the other states, which isn't loaded here, so you may qualify at a higher income than shown. Ask your state.",
      st + " tiene un nivel de pobreza más alto que los demás estados, que no está cargado aquí, así que podría calificar con ingresos más altos de lo que se muestra. Pregunte en su estado.") : "";
    if (warn) out.forEach(function (x) { if (x.status === "no" && x.id !== "gap") x.status = "maybe"; });
    return { pct: pct, warn: warn, results: out.sort(function (a, b) { return rank[a.status] - rank[b.status]; }) };
  }
  return { check: check, pctFPL: pctFPL };
})();

if (typeof document !== "undefined") (function () {
  var view = document.getElementById("view-covered");
  if (!view) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
  view.innerHTML = "<section class='tool-intro'><h2>Get covered</h2><p>See which health coverage you may qualify for. It takes about a minute. <span class='hint'>Nothing you type leaves this page.</span></p></section>" +
    "<div class='card'><div class='grid'>" +
    "<label>State<select id='gcState'>" + STATES.map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select></label>" +
    "<label>People in your household<input id='gcSize' type='number' min='1' value='1'></label>" +
    "<label>Household income per year, before taxes<input id='gcIncome' type='number' min='0' placeholder='e.g. 28000'></label>" +
    "<label>Immigration status (optional)<select id='gcStatus'><option value='unsure'>Prefer not to say</option><option value='citizen'>US citizen</option><option value='greencard'>Green card holder</option><option value='other'>Other lawful status (visa, refugee, parole, etc.)</option></select></label></div>" +
    "<div class='checklist'><label><input type='checkbox' id='gcKids'> Children under 19 live with me</label>" +
    "<label><input type='checkbox' id='gcPreg'> Someone in my household is pregnant</label>" +
    "<label><input type='checkbox' id='gcMedicare'> I have Medicare (or I'm 65 or older)</label></div>" +
    "<label id='gcSavingsWrap' class='hidden'>Savings, checking and investments (not your home or car)<input id='gcSavings' type='number' min='0' placeholder='optional'></label>" +
    "<div class='row-actions'><button class='primary' id='gcGo'>Check what I may qualify for</button></div></div><div id='gcOut'></div>" +
    "<p class='hint'>Checked against official sources on " + esc(COVERED_RULES.checked) + ". Only your state's Medicaid office or HealthCare.gov can decide. When in doubt, apply.</p>";
  document.getElementById("gcMedicare").onchange = function (e) { document.getElementById("gcSavingsWrap").classList.toggle("hidden", !e.target.checked); };
  document.getElementById("gcGo").onclick = function () {
    var inc = document.getElementById("gcIncome").value, size = +document.getElementById("gcSize").value || 1;
    if (inc === "" || +inc < 0) { document.getElementById("gcOut").innerHTML = "<p class='warn'>Enter your household's yearly income (0 is fine).</p>"; return; }
    var sv = document.getElementById("gcSavings").value;
    var r = CoveredLogic.check({ state: document.getElementById("gcState").value, size: size, income: +inc, kids: document.getElementById("gcKids").checked,
      pregnant: document.getElementById("gcPreg").checked, medicare: document.getElementById("gcMedicare").checked, savings: sv === "" ? null : +sv,
      status: document.getElementById("gcStatus").value, lang: document.documentElement.lang }, NAV_CONFIG, COVERED_RULES, MEDICAID_STATES);
    var pill = { likely: "<span class='pill yes'>Likely</span>", maybe: "<span class='pill maybe'>Maybe</span>", no: "<span class='pill no'>Probably not</span>" };
    document.getElementById("gcOut").innerHTML = "<div class='card'><p>" + (document.documentElement.lang === "es" ? "Su hogar está al <b>" + r.pct + "%</b> del nivel de pobreza de 2026." : "Your household is at <b>" + r.pct + "%</b> of the 2026 poverty line.") + "</p>" + (r.warn ? "<p class='warn'>" + esc(r.warn) + "</p>" : "") + "</div>" +
      r.results.map(function (x) {
        return "<div class='card prog " + x.status + "'><div class='prog-head'><h3>" + esc(x.name) + "</h3>" + pill[x.status] + "</div><p>" + esc(x.why) + "</p>" +
          (x.note ? "<p class='hint'>" + esc(x.note) + "</p>" : "") +
          (x.url || x.phone ? "<p>" + (x.url ? "<a href='" + esc(x.url) + "' target='_blank' rel='noopener'>Apply or learn more</a>" : "") + (x.phone ? " · <a href='tel:" + esc(x.phone.replace(/[^0-9]/g, "")) + "'>" + esc(x.phone) + "</a>" : "") + "</p>" : "") + "</div>";
      }).join("") +
      helpfulBox("fbCovered") + "<div class='card'><h3>How to apply for Medicaid or CHIP</h3><p>Apply through your state's Medicaid office or at <a href='https://www.healthcare.gov/' target='_blank' rel='noopener'>HealthCare.gov</a>, which sends your application to your state. You can apply any time of year.</p></div>";
    wireHelpful("fbCovered", "Get covered");
  };
})();
