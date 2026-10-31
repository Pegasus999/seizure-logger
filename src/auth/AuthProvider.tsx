// App.tsx calls initDb() before rendering this provider; it is not called here.
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  ensureDefaultSymptoms,
  getSetting,
  hasLocalData,
  setCurrentUser,
  setSetting,
  wipeLocalData,
} from '../db/repo';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { syncNow } from '../sync/sync';

type Result = { error?: string };

export interface AuthState {
  session: Session | null;
  userId: string | null;
  loading: boolean;
  localOnly: boolean;
  signInWithPassword(email: string, password: string): Promise<Result>;
  signUp(email: string, password: string): Promise<Result>;
  signOut(): Promise<Result>;
  deleteAccount(): Promise<Result>;
}

const AuthContext = createContext<AuthState | null>(null);

const LOCAL_USER = 'local';

function msg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    return { error: msg(e) };
  }
}

function activateUser(userId: string): void {
  const stored = getSetting('owner_user_id');
  if (stored !== userId && hasLocalData()) {
    // Different account (or unowned local-only data) on this phone: start clean.
    wipeLocalData();
  }
  setSetting('owner_user_id', userId);
  setCurrentUser(userId);
}

/** Pull first so a second device receives existing symptoms instead of seeding duplicates. */
async function bootstrapSync(): Promise<void> {
  try {
    await syncNow();
    ensureDefaultSymptoms();
  } catch {
    // ignore; auto sync retries later
  }
  void syncNow();
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const localOnly = !isSupabaseConfigured;
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<string | null>(localOnly ? LOCAL_USER : null);
  const [loading, setLoading] = useState<boolean>(!localOnly);
  const activeUser = useRef<string | null>(null);

  const applySession = useCallback((s: Session | null) => {
    const id = s?.user?.id ?? null;
    setSession(s);
    if (id !== activeUser.current) {
      activeUser.current = id;
      if (id) {
        try {
          activateUser(id);
        } catch {
          // keep going; UI still works from whatever is in the db
        }
        void bootstrapSync();
      } else {
        setCurrentUser(null);
      }
      setUserId(id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      try {
        setCurrentUser(LOCAL_USER);
        ensureDefaultSymptoms();
        setSetting('owner_user_id', LOCAL_USER);
      } catch {
        // ignore
      }
      return;
    }
    let cancelled = false;
    // Do not call supabase methods synchronously inside this callback (deadlock risk): defer.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => {
        if (!cancelled) applySession(s);
      }, 0);
    });
    supabase.auth
      .getSession()
      .then(({ data: d }) => {
        if (!cancelled) applySession(d.session);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithPassword = useCallback(
    (email: string, password: string) =>
      guarded(async () => {
        if (!supabase) return { error: 'Sync is not configured' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      }),
    [],
  );

  const signUp = useCallback(
    (email: string, password: string) =>
      guarded(async () => {
        if (!supabase) return { error: 'Sync is not configured' };
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: error.message };
        if (!data.session) return { error: 'Check your email to confirm your account, then sign in.' };
        return {};
      }),
    [],
  );

  const endSession = useCallback(async (): Promise<Result> => {
    let error: string | undefined;
    if (supabase) {
      try {
        const r = await supabase.auth.signOut({ scope: 'local' });
        if (r.error) error = r.error.message;
      } catch (e) {
        error = msg(e);
      }
    }
    activeUser.current = null;
    wipeLocalData();
    setCurrentUser(null);
    if (!supabase) {
      // local-only mode stays usable with a fresh empty local profile
      setCurrentUser(LOCAL_USER);
      ensureDefaultSymptoms();
    }
    setSession(null);
    setUserId(supabase ? null : LOCAL_USER);
    return error ? { error } : {};
  }, []);

  const signOut = useCallback(() => guarded(endSession), [endSession]);

  const deleteAccount = useCallback(
    () =>
      guarded(async () => {
        if (supabase) {
          const { error } = await supabase.rpc('delete_my_account');
          if (error) return { error: error.message };
        }
        return endSession();
      }),
    [endSession],
  );

  const value = useMemo<AuthState>(
    () => ({
      session,
      userId,
      loading,
      localOnly,
      signInWithPassword,
      signUp,
      signOut,
      deleteAccount,
    }),
    [session, userId, loading, localOnly, signInWithPassword, signUp, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
