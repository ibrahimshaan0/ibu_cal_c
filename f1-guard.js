(() => {
  // Best-effort only. Edge may handle F1 at browser level before a page event is dispatched.
  // This script only runs on websites where the extension has site access.
  let enabled = true;

  const syncSetting = () => {
    try {
      chrome.storage.local.get({ f1GuardEnabled: true }, data => {
        enabled = data.f1GuardEnabled !== false;
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.f1GuardEnabled) {
          enabled = changes.f1GuardEnabled.newValue !== false;
        }
      });
    } catch (_) {
      // Keep the default enabled state if extension storage is unavailable.
    }
  };

  function blockF1(event) {
    if (!enabled || (event.key !== "F1" && event.code !== "F1")) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    // Intentionally no toast or alert: don't interrupt the user's workflow.
    return false;
  }

  syncSetting();
  // Capture early, before ordinary page-level keyboard handlers.
  for (const target of [window, document]) {
    target.addEventListener("keydown", blockF1, { capture: true, passive: false });
    target.addEventListener("keyup", blockF1, { capture: true, passive: false });
  }
})();
