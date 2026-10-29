// Load big data files only when they're needed, so the page opens fast on a phone.
// loadScript(src) returns a Promise and never loads the same file twice.
(function () {
  var cache = {};
  window.loadScript = function (src) {
    if (!cache[src]) cache[src] = new Promise(function (ok, bad) {
      var s = document.createElement("script"); s.src = src; s.onload = ok;
      s.onerror = function () { delete cache[src]; bad(new Error("Couldn't load " + src + ". Check your connection and try again.")); };
      document.head.appendChild(s);
    });
    return cache[src];
  };
  // Hospital list + policies: needed on the Hospital bill tab.
  window.loadHospitalData = function () { return Promise.all([loadScript("hospitals.js"), loadScript("hospital-policies.js")]); };

  // Installable app: register the offline helper. Browsers only allow this on a web address (https or localhost), not a file.
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    // When a newer version takes over (not the very first install), reload once so the new version shows right away.
    var hadOld = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (hadOld && !reloaded) { reloaded = true; location.reload(); } });
  }
  // Offline notice
  function offline() {
    var bar = document.getElementById("offlineBar");
    if (!navigator.onLine) {
      if (!bar) {
        bar = document.createElement("div"); bar.id = "offlineBar"; bar.className = "offline-bar no-print"; bar.setAttribute("role", "status");
        bar.textContent = "You're offline. The app still works with information saved on this device. Calling a number or opening a website needs a connection.";
        document.body.insertBefore(bar, document.body.firstChild);
      }
    } else if (bar) bar.remove();
  }
  window.addEventListener("online", offline); window.addEventListener("offline", offline);
  window.addEventListener("load", offline);
})();
