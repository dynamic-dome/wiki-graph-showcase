/**
 * Toggle data-theme attribute on <html>. Persists to localStorage and emits
 * a "themechange" event so the rest of the app can react (e.g. recompute colors).
 */

const STORAGE_KEY = "wikigraphshowcase.theme";
const VALID = ["crab", "dome"];

export function createThemeSwitcher(toggleButton, currentLabelEl) {
  function set(theme) {
    if (!VALID.includes(theme)) return;
    document.documentElement.setAttribute("data-theme", theme);
    currentLabelEl.textContent = theme;
    // Expose state to assistive tech: crab is the default, dome is "pressed".
    toggleButton.setAttribute("aria-pressed", theme === "dome" ? "true" : "false");
    toggleButton.setAttribute("aria-label", `Theme: ${theme} — umschalten`);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_e) {
      // ignore private-mode etc
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }

  function next() {
    const current = document.documentElement.getAttribute("data-theme");
    set(current === "crab" ? "dome" : "crab");
  }

  function get() {
    return document.documentElement.getAttribute("data-theme");
  }

  function loadStored() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID.includes(stored)) return stored;
    } catch (_e) {}
    return null;
  }

  toggleButton.addEventListener("click", next);

  return { set, next, get, loadStored };
}
