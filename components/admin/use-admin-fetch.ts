"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { clearAdminToken } from "@/lib/admin-auth";

/**
 * Run an admin API call with loading/error state. On 401/403 (token missing,
 * expired, or rejected) it clears the stored token and bounces to /admin so the
 * ops user re-authenticates — every admin page shares this behavior.
 *
 * `deps` controls re-fetching (e.g. filter/page changes); pass the values the
 * fetcher closes over.
 */
export function useAdminFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearAdminToken();
        router.replace("/admin");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run };
}
