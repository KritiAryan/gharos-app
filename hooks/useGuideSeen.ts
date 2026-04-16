import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type GuideKey =
  | "welcome"
  | "home"
  | "plan"
  | "mealCards"
  | "weeklyPlan"
  | "activePlan"
  | "pantry"
  | "shopping"
  | "mealPrep"
  | "settings";

/**
 * Tracks whether a user has seen a given guide.
 * Reads/writes to profiles.config.guideSeen[key] (JSONB).
 *
 * Returns:
 *  - shouldShow: true when the guide should be rendered (loaded + not seen)
 *  - markSeen:   persists guideSeen[key] = true and hides the guide
 *  - loading:    while fetching the initial state
 */
export function useGuideSeen(key: GuideKey) {
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState(true); // default hidden until we know

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) {
            setSeen(true);
            setLoading(false);
          }
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("config")
          .eq("id", session.user.id)
          .maybeSingle();

        const guideSeen = (data?.config?.guideSeen || {}) as Record<string, boolean>;
        if (mounted) {
          setSeen(!!guideSeen[key]);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setSeen(true); // fail closed — don't pester the user
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key]);

  const markSeen = useCallback(async () => {
    setSeen(true); // optimistic
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("profiles")
        .select("config")
        .eq("id", session.user.id)
        .maybeSingle();

      const config = data?.config || {};
      const guideSeen = { ...(config.guideSeen || {}), [key]: true };

      await supabase
        .from("profiles")
        .update({ config: { ...config, guideSeen } })
        .eq("id", session.user.id);
    } catch {
      /* silent — UI already hidden */
    }
  }, [key]);

  return { shouldShow: !loading && !seen, loading, markSeen };
}
