import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type {
  DrillAttemptRecord,
  MasterySummary,
  UserPreferences,
} from '../poker/types';
import {
  auth,
  clearCloudHistory,
  loadOrCreateCloudProfile,
  persistCloudAttemptAndSummary,
  persistCloudPreferences,
  signInWithGoogle,
  signOutUser,
} from '../services/firebase';

const STORAGE_KEY_ATTEMPTS = 'feltlab_attempts_v1';
const STORAGE_KEY_SUMMARY = 'feltlab_summary_v1';
const STORAGE_KEY_PREFS = 'feltlab_prefs_v1';

const DEFAULT_SUMMARY: MasterySummary = {
  totalDecisions: 0,
  optimalCount: 0,
  totalEvLossBb: 0,
  currentStreak: 0,
  bestStreak: 0,
};

const DEFAULT_PREFS: UserPreferences = {
  fourColorDeck: true,
  soundEnabled: true,
};

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useMasteryStore() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [attempts, setAttempts] = useState<DrillAttemptRecord[]>(() =>
    readLocal(STORAGE_KEY_ATTEMPTS, [])
  );
  const [summary, setSummary] = useState<MasterySummary>(() =>
    readLocal(STORAGE_KEY_SUMMARY, DEFAULT_SUMMARY)
  );
  const [prefs, setPrefs] = useState<UserPreferences>(() =>
    readLocal(STORAGE_KEY_PREFS, DEFAULT_PREFS)
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(attempts.slice(0, 200)));
    } catch {
      // Ignore storage quota errors
    }
  }, [attempts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SUMMARY, JSON.stringify(summary));
    } catch {
      // Ignore storage quota errors
    }
  }, [summary]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setSyncing(true);
        setSyncError(null);
        try {
          const cloud = await loadOrCreateCloudProfile(
            nextUser,
            readLocal(STORAGE_KEY_SUMMARY, DEFAULT_SUMMARY),
            readLocal(STORAGE_KEY_PREFS, DEFAULT_PREFS)
          );
          if (cloud.summary.totalDecisions > 0 || cloud.attempts.length > 0) {
            setSummary(cloud.summary);
            setAttempts(cloud.attempts);
          }
          setPrefs(cloud.prefs);
        } catch (err) {
          setSyncError(
            err instanceof Error ? 'Cloud sync paused—continuing with local session.' : 'Sync failed.'
          );
        } finally {
          setSyncing(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const recordAttempt = useCallback(
    (entry: Omit<DrillAttemptRecord, 'id' | 'timestamp'>) => {
      const attempt: DrillAttemptRecord = {
        ...entry,
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
      };

      const isGood = attempt.grade === 'Optimal' || attempt.grade === 'Acceptable';
      let nextSummary: MasterySummary = DEFAULT_SUMMARY;

      setSummary((prev) => {
        const nextStreak = isGood ? prev.currentStreak + 1 : 0;
        nextSummary = {
          totalDecisions: prev.totalDecisions + 1,
          optimalCount: prev.optimalCount + (isGood ? 1 : 0),
          totalEvLossBb: Number((prev.totalEvLossBb + attempt.evLossBb).toFixed(2)),
          currentStreak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
        };
        return nextSummary;
      });

      setAttempts((prev) => [attempt, ...prev].slice(0, 200));

      if (user) {
        void persistCloudAttemptAndSummary(user, attempt, nextSummary, prefs).catch(() => {
          setSyncError('Could not sync latest hand to cloud—saved locally.');
        });
      }
    },
    [user, prefs]
  );

  const updatePrefs = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        if (user) {
          void persistCloudPreferences(user, next).catch(() => {});
        }
        return next;
      });
    },
    [user]
  );

  const handleSignIn = useCallback(async () => {
    setSyncError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setSyncError(
        err instanceof Error && err.message.includes('popup-closed')
          ? 'Sign-in cancelled.'
          : 'Google sign-in unavailable right now. Local progress remains active.'
      );
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setSyncError(null);
    await signOutUser();
  }, []);

  const resetProgress = useCallback(async () => {
    setAttempts([]);
    setSummary(DEFAULT_SUMMARY);
    if (user) {
      try {
        await clearCloudHistory(user);
      } catch {
        setSyncError('Local history cleared; cloud clear failed.');
      }
    }
  }, [user]);

  return {
    user,
    authReady,
    syncing,
    syncError,
    attempts,
    summary,
    prefs,
    recordAttempt,
    updatePrefs,
    handleSignIn,
    handleSignOut,
    resetProgress,
  };
}
