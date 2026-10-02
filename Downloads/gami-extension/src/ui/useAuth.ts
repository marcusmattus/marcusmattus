import { useCallback, useEffect, useState } from 'react';
import { getAuthProvider } from '../auth/session';
import { toErrorInfo, userMessage } from '../shared/errors';
import { send } from './store';

const OTP_KEY = 'gami:otp';
type Step = { step: 'email' } | { step: 'code'; email: string };

/**
 * Email one-time-code sign up / sign in. The pending step is kept in session
 * storage because the popup closes when the user switches to their inbox.
 */
export function useAuth() {
  const [step, setStep] = useState<Step>({ step: 'email' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const got = await chrome.storage.session.get(OTP_KEY);
      const saved = got[OTP_KEY] as { email?: unknown } | undefined;
      if (typeof saved?.email === 'string') setStep({ step: 'code', email: saved.email });
      try {
        const session = await (await getAuthProvider()).restore();
        if (session) await send({ type: 'AUTH_STATUS', session });
      } catch (e) { setError(userMessage(toErrorInfo(e))); }
    })();
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(userMessage(toErrorInfo(e))); } finally { setBusy(false); }
  }, []);

  const sendCode = useCallback((email: string) => run(async () => {
    await (await getAuthProvider()).sendCode(email);
    await chrome.storage.session.set({ [OTP_KEY]: { email } });
    setStep({ step: 'code', email });
  }), [run]);

  const verify = useCallback((email: string, code: string) => run(async () => {
    const session = await (await getAuthProvider()).verifyCode(email, code);
    await chrome.storage.session.remove(OTP_KEY);
    setStep({ step: 'email' });
    await send({ type: 'AUTH_STATUS', session });
  }), [run]);

  const reset = useCallback(() => {
    void chrome.storage.session.remove(OTP_KEY);
    setStep({ step: 'email' }); setError(null);
  }, []);

  const signOut = useCallback(() => run(async () => {
    await (await getAuthProvider()).signOut();
    await send({ type: 'AUTH_STATUS', session: null });
  }), [run]);

  return { step, busy, error, sendCode, verify, reset, signOut };
}
