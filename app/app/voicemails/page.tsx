"use client";

/**
 * Cloud Softphone "Custom Web Tab" — voicemails.
 *
 * Loads inside the Acrobits Cloud Softphone embedded browser at
 *   /app/voicemails?username={authUsername}&password={password}
 * (the Acrobits template substitutes the subscriber's SIP credentials). We
 * exchange those for a customer JWT via POST /v1/app/auth, then load the
 * voicemail list. The JWT lives only in component state; the credentials are
 * stripped from the visible URL after auth.
 *
 * Mobile-first: designed for a 375px iPhone viewport in the embedded browser,
 * dark theme matching the mymobilitynet.io brand (.brand-dark).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Voicemail as VoicemailIcon,
  RefreshCw,
  Loader2,
  Check,
  Phone,
  AlertCircle,
} from "lucide-react";

import {
  appAuth,
  getAppVoicemails,
  markAppVoicemailRead,
  ApiError,
  type AppVoicemail,
} from "@/lib/api";
import { formatPhone } from "@/lib/format";

/** Seconds → "0:23" / "1:05". */
function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** ISO → "Jul 10, 2026 · 2:14 PM". */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

const PULL_THRESHOLD = 70;

export default function AppVoicemailsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [voicemails, setVoicemails] = useState<AppVoicemail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Pull-to-refresh state.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const loadVoicemails = useCallback(async (jwt: string) => {
    const { voicemails: list } = await getAppVoicemails(jwt);
    setVoicemails(list);
  }, []);

  // Authenticate once with the SIP credentials from the URL, then load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const username = params.get("username") ?? "";
      const password = params.get("password") ?? "";
      if (!username || !password) {
        setError("Missing sign-in details. Please reopen from your dialer.");
        setLoading(false);
        return;
      }
      try {
        const auth = await appAuth(username, password);
        if (cancelled) return;
        setToken(auth.token);
        // Strip the credentials from the visible URL for safety.
        window.history.replaceState({}, "", "/app/voicemails");
        await loadVoicemails(auth.token);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 401
            ? "We couldn't sign you in. Please reopen from your dialer."
            : "Something went wrong loading your voicemails.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVoicemails]);

  const refresh = useCallback(async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadVoicemails(token);
    } catch {
      setError("Couldn't refresh. Pull down to try again.");
    } finally {
      setRefreshing(false);
    }
  }, [token, refreshing, loadVoicemails]);

  async function handleMarkRead(id: string) {
    if (!token) return;
    setMarkingId(id);
    // Optimistic — flip locally, then confirm with the server.
    setVoicemails((vms) => vms.map((v) => (v.id === id ? { ...v, is_read: true } : v)));
    try {
      await markAppVoicemailRead(id, token);
    } catch {
      // Roll back on failure.
      setVoicemails((vms) => vms.map((v) => (v.id === id ? { ...v, is_read: false } : v)));
    } finally {
      setMarkingId(null);
    }
  }

  // --- Pull-to-refresh touch handlers (only engage at the top of the list) ---
  function onTouchStart(e: React.TouchEvent) {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      // Dampen the pull so it feels elastic; cap the indicator travel.
      setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD + 20));
    }
  }
  function onTouchEnd() {
    if (pullDistance >= PULL_THRESHOLD) refresh();
    pullStartY.current = null;
    setPullDistance(0);
  }

  const unreadCount = voicemails.filter((v) => !v.is_read).length;

  return (
    <main className="brand-dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <VoicemailIcon className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Voicemail</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={!token || refreshing}
            aria-label="Refresh"
            className="rounded-full p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </header>

        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="flex items-center justify-center overflow-hidden text-muted-foreground"
            style={{ height: pullDistance }}
          >
            <RefreshCw
              className={`h-5 w-5 ${
                pullDistance >= PULL_THRESHOLD ? "text-primary" : ""
              }`}
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        )}

        {/* Scrollable list */}
        <div
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex-1 overflow-y-auto px-3 pb-8 pt-3"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading your voicemails…</p>
            </div>
          ) : error ? (
            <div className="mx-2 mt-10 flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-card p-6 text-center">
              <AlertCircle className="h-7 w-7 text-primary" />
              <p className="text-sm text-card-foreground">{error}</p>
              {token && (
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Try again
                </button>
              )}
            </div>
          ) : voicemails.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
              <VoicemailIcon className="h-10 w-10 opacity-40" />
              <p className="text-base font-medium text-foreground">No voicemails yet</p>
              <p className="text-sm">When someone leaves a message, it&apos;ll show up here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {voicemails.map((vm) => (
                <li
                  key={vm.id}
                  className={`rounded-xl border bg-card p-4 shadow-sm transition ${
                    vm.is_read ? "border-white/10" : "border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {!vm.is_read && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-semibold tabular-nums text-card-foreground">
                        {formatPhone(vm.caller_number)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDuration(vm.duration_seconds)}
                    </span>
                  </div>

                  <p className="mt-1 pl-6 text-xs text-muted-foreground">
                    {formatDateTime(vm.created_at)}
                  </p>

                  {vm.transcription ? (
                    <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm leading-relaxed text-card-foreground">
                      {vm.transcription}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted-foreground">
                      Transcription not available yet.
                    </p>
                  )}

                  {vm.recording_url ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio
                      controls
                      preload="none"
                      src={vm.recording_url}
                      className="mt-3 w-full"
                    />
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Recording unavailable.
                    </p>
                  )}

                  {!vm.is_read && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleMarkRead(vm.id)}
                        disabled={markingId === vm.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        {markingId === vm.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Mark as read
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
