import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Supabase recovery links land on the site root with the tokens in the URL hash
// (`/#access_token=...&type=recovery`), so the landing page renders and supabase-js
// consumes the hash before the reset screen ever mounts. Rewrite the path first --
// this is synchronous, so it runs before supabase-js clears the hash and before the
// router reads the URL.
const recoveryHash = window.location.hash;
const isRecoveryCallback =
  recoveryHash.includes("type=recovery") && recoveryHash.includes("access_token");
if (isRecoveryCallback && window.location.pathname !== "/reset-password") {
  window.history.replaceState(
    window.history.state,
    "",
    `/reset-password${window.location.search}${recoveryHash}`,
  );
}

// App version — bump this whenever a deploy needs to invalidate stale client caches/sessions.
const APP_VERSION = "2026-04-29-4";
const VERSION_KEY = "fa_app_version";

(async () => {
  try {
    const stored = localStorage.getItem(VERSION_KEY);
    // Skip the cache-busting reload for a recovery callback: supabase-js clears the
    // URL hash one await before it persists the session, so a reload landing in that
    // gap loses both and the reset link dies. Normal visits are unaffected, and the
    // version stays unset so the next normal load still busts the cache.
    if (!isRecoveryCallback && stored !== APP_VERSION) {
      // Preserve Supabase auth tokens so users stay signed in after the reload.
      const preserved: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith("sb-") || key.includes("supabase.auth")) {
          const val = localStorage.getItem(key);
          if (val !== null) preserved[key] = val;
        }
      }

      // Clear all client-side storage
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      // Restore auth tokens
      for (const [k, v] of Object.entries(preserved)) {
        try { localStorage.setItem(k, v); } catch {}
      }

      // Unregister any service workers from previous deploys
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      // Clear browser Cache Storage
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      localStorage.setItem(VERSION_KEY, APP_VERSION);

      // Force every existing visitor to fetch the new build once.
      window.location.reload();
      return;
    }
  } catch {
    // non-fatal
  }

  createRoot(document.getElementById("root")!).render(<App />);
})();
