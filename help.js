// "Talk to a person" (on every tab) and "Was this helpful?" (after every result).
// Phone numbers were checked on each organization's official page (see HELP_CHECKED). Feedback stays on this device.

var HELP_CHECKED = "2026-10-21";
var HELP_LINES = [
  { group: "Emergency", items: [
    { name: "Emergency: 911", what: "Chest pain, trouble breathing, signs of stroke, severe bleeding, overdose.", tel: "911" },
    { name: "988 Suicide & Crisis Lifeline", what: "Call or text 988, free, 24/7. For thoughts of suicide, a mental health or substance use crisis.", tel: "988", url: "https://988lifeline.org/" }] },
  { group: "Help finding services near you", items: [
    { name: "211", what: "Connects you to local help with bills, food, rent, and health services. Every call is completely confidential.", tel: "211", url: "https://www.211.org/" }] },
  { group: "Hospital and medical bills", items: [
    { name: "The hospital's financial counselor", what: "Call the billing office on your bill and ask for a financial counselor. Ask about financial assistance and payment plans." },
    { name: "No Surprises Help Desk", what: "Surprise bills, or a bill much higher than your estimate. Weekdays 8am to 8pm ET, weekends 10am to 6pm ET.", tel: "1-800-985-3059", url: "https://www.cms.gov/medical-bill-rights" }] },
  { group: "Health coverage", items: [
    { name: "HealthCare.gov", what: "Marketplace plans and help applying. 24 hours a day, 7 days a week (except holidays).", tel: "1-800-318-2596", url: "https://www.healthcare.gov/contact-us/" },
    { name: "1-800-MEDICARE", what: "Questions about Medicare. TTY: 1-877-486-2048.", tel: "1-800-633-4227", url: "https://www.medicare.gov/talk-to-someone" },
    { name: "SHIP: free Medicare counseling", what: "Free, unbiased one-on-one help choosing and using Medicare.", tel: "877-839-2675", url: "https://www.shiphelp.org/" }] },
  { group: "Legal help", items: [
    { name: "Find free legal aid", what: "Civil legal aid for low-income people: medical debt, collections, insurance denials.", url: "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help" }] }
];

var Feedback = (function () {
  var KEY = "cn_feedback_v1";
  function all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  // Only the tab, yes/no, an optional reason and the date. Never what the person typed.
  function record(area, helpful, reason) {
    var a = all(); a.push({ area: area, helpful: helpful, reason: reason || "", date: (function (d) { return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })(new Date()) });
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }
  function summary() {
    var by = {};
    all().forEach(function (f) {
      var s = by[f.area] = by[f.area] || { yes: 0, no: 0, reasons: {} };
      if (f.helpful) s.yes++; else s.no++;
      if (f.reason) s.reasons[f.reason] = (s.reasons[f.reason] || 0) + 1;
    });
    return by;
  }
  function setLastReason(r) { var a = all(); if (a.length) { a[a.length - 1].reason = r; try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} } }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  return { all: all, record: record, setLastReason: setLastReason, summary: summary, clear: clear, KEY: KEY };
})();

if (typeof document !== "undefined") (function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  // ---------- Talk to a person
  var btn = document.createElement("button");
  btn.id = "talkBtn"; btn.className = "talk-btn no-print"; btn.type = "button"; btn.textContent = "Talk to a person";
  var panel = document.createElement("div");
  panel.id = "talkPanel"; panel.className = "talk-panel hidden no-print"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Talk to a person");
  panel.innerHTML = "<div class='talk-head'><h2>Talk to a person</h2><button type='button' class='ghost' id='talkClose' aria-label='Close'>✕</button></div>" +
    "<p class='hint'>Free help from real people. Tap a number to call.</p>" +
    HELP_LINES.map(function (g) {
      return "<h3>" + esc(g.group) + "</h3>" + g.items.map(function (i) {
        return "<div class='talk-item'><b>" + esc(i.name) + "</b><p>" + esc(i.what) + "</p>" +
          (i.tel ? "<a class='primary call' href='tel:" + esc(i.tel.replace(/[^0-9]/g, "")) + "'>Call " + esc(i.tel) + "</a> " : "") +
          (i.url ? "<a href='" + esc(i.url) + "' target='_blank' rel='noopener'>Website</a>" : "") + "</div>";
      }).join("");
    }).join("") +
    "<p class='hint'>Numbers checked on each organization's official site, " + HELP_CHECKED + ".</p>";
  document.body.appendChild(btn); document.body.appendChild(panel);
  function open(on) { panel.classList.toggle("hidden", !on); btn.setAttribute("aria-expanded", on ? "true" : "false"); if (on) document.getElementById("talkClose").focus(); }
  btn.onclick = function () { open(panel.classList.contains("hidden")); };
  document.getElementById("talkClose").onclick = function () { open(false); btn.focus(); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.classList.contains("hidden")) { open(false); btn.focus(); } });

  // ---------- Was this helpful?
  var NO_REASONS = ["Confusing", "Didn't fit my situation", "Missing information", "Something looked wrong"];
  window.helpfulBox = function (id) {
    return "<div class='helpful no-print' id='" + id + "'><span>Was this helpful?</span> <button type='button' class='ghost' data-h='yes'>👍 Yes</button> <button type='button' class='ghost' data-h='no'>👎 No</button>" +
      "<span class='hint'> · saved only on this device</span><div class='helpful-why hidden'>" +
      NO_REASONS.map(function (r) { return "<button type='button' class='ghost' data-r='" + esc(r) + "'>" + esc(r) + "</button>"; }).join(" ") + "</div></div>";
  };
  window.wireHelpful = function (id, area) {
    var box = document.getElementById(id); if (!box) return;
    box.querySelector("[data-h='yes']").onclick = function () { Feedback.record(area, true); box.innerHTML = "<span>Thanks! Glad it helped.</span>"; };
    box.querySelector("[data-h='no']").onclick = function () {
      Feedback.record(area, false);                       // a "no" counts even without a reason
      box.querySelectorAll("[data-h]").forEach(function (b) { b.disabled = true; });
      box.querySelector(".helpful-why").classList.remove("hidden");
      box.querySelectorAll("[data-r]").forEach(function (b) {
        b.onclick = function () { Feedback.setLastReason(b.dataset.r); box.innerHTML = "<span>Thanks for telling us. Need help now? Tap <b>Talk to a person</b>.</span>"; };
      });
    };
  };
})();
