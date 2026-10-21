// Everything a hospital customer would change lives here.
// Anything marked SAMPLE is a placeholder, not a real hospital's policy.

var NAV_CONFIG = {
  // 2026 HHS poverty guidelines, 48 contiguous states + DC.
  // Federal Register Vol. 91 No. 10, 15 Jan 2026 (2026-00755).
  // Alaska and Hawaii use separate, higher tables - not loaded yet.
  FPL: { year: 2026, base: 15960, perAdditional: 5680, unsupportedStates: ["AK", "HI"] },

  // No made-up hospital discount tiers. The 501(r) screener uses, in order:
  // the hospital's own policy (if entered), then the state's legal minimum (state-laws.js), else "depends on the hospital".
  // Federal minimums from Treas. Reg. 1.501(r)-6. Hospitals may be more generous.
  RULES_501R: {
    applicationWindowDays: 240, // must accept applications for at least 240 days after first post-discharge bill
    noEcaBeforeDays: 120        // no extraordinary collection actions before 120 days after first post-discharge bill
  }
};

if (typeof module !== "undefined") module.exports = NAV_CONFIG;
