// Test-session input collector for the M5 eval suite (eval/m5). OFF unless the link ends in ?collect=1.
// Records exactly what the tester types into the Get help search bar and the guidance chat, on this device only,
// and downloads it as rows for eval/m5/inputs.csv. Nothing is sent anywhere. ?collect=0 turns it off.
(function () {
  if (typeof document === "undefined") return;
  var KEY = "m5.inputs", ON = "m5.collect";
  var q = (location.search.match(/[?&]collect=(\d)/) || [])[1];
  try { if (q === "1") sessionStorage.setItem(ON, "1"); if (q === "0") sessionStorage.removeItem(ON); if (sessionStorage.getItem(ON) !== "1") return; } catch (e) { return; }
  function all() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} paint(); }
  function add(where, text, note) {
    text = String(text || "").trim(); if (!text) return;
    var list = all(), last = list[list.length - 1];
    if (last && last.text === text && last.where === where && Date.now() - last.t < 2000) return;  // same submit seen twice
    list.push({ where: where, text: text, note: note || "", t: Date.now() }); save(list);
  }
  var bar = document.createElement("div");
  bar.className = "collect-bar no-print"; bar.setAttribute("data-no-i18n", ""); bar.setAttribute("role", "status");
  function paint() {
    var n = all().length;
    bar.innerHTML = "<b>Test session</b>: " + n + " input" + (n === 1 ? "" : "s") + " recorded on this device. No real names, please. " +
      "<button type='button' id='m5Dl'>Download CSV</button> <button type='button' id='m5Wipe'>Erase</button> <button type='button' id='m5Off'>Stop</button>";
    bar.querySelector("#m5Dl").onclick = download;
    bar.querySelector("#m5Wipe").onclick = function () { if (confirm("Erase the " + all().length + " recorded inputs from this device?")) save([]); };
    bar.querySelector("#m5Off").onclick = function () { try { sessionStorage.removeItem(ON); } catch (e) {} bar.remove(); };
  }
  function cell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download() {
    var rows = [["id", "date_collected", "where", "source", "collected_by", "exact_input", "expected_outcome", "expected_detail", "expected_set_by", "notes"]];
    all().forEach(function (r, i) {
      var d = new Date(r.t), day = d.toISOString().slice(0, 10);
      rows.push(["s" + day.replace(/-/g, "") + "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "-" + (i + 1), day, r.where, "", "", r.text, "", "", "", r.note]);
    });
    var blob = new Blob([rows.map(function (r) { return r.map(cell).join(","); }).join("\n") + "\n"], { type: "text/csv" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "m5-inputs-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
  }
  // Capture before the app clears the box: Enter in the search bar or chat, the chat's Send button, a picked suggestion.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || !e.target) return;
    if (e.target.id === "drugSearch") {
      var sel = document.querySelector("#drugSuggest button.on");
      add("search", e.target.value, sel ? "picked suggestion: " + sel.textContent.trim() : "");
    }
    if (e.target.id === "guideIn") add("guide", e.target.value);
  }, true);
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    if (t.closest("#guideSend")) { var g = document.getElementById("guideIn"); if (g) add("guide", g.value); }
    var s = t.closest("#drugSuggest button");
    if (s) { var box = document.getElementById("drugSearch"); add("search", box ? box.value : "", "picked suggestion: " + s.textContent.trim()); }
  }, true);
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(bar); paint(); });
  if (document.readyState !== "loading") { document.body.appendChild(bar); paint(); }
})();
