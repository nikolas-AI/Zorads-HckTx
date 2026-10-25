import { browserDb } from "@/lib/supabase";

let authPromise: ReturnType<ReturnType<typeof browserDb>["auth"]["signInAnonymously"]> | undefined;
export async function identity() {
  const db = browserDb();
  const { data, error } = await db.auth.getSession();
  if (error) throw new Error("Could not restore your session. Please retry before creating a new identity.");
  if (data.session) return data.session.user;
  authPromise ??= db.auth.signInAnonymously();
  const result = await authPromise.finally(() => { authPromise = undefined; });
  if (result.error || !result.data.user) throw new Error("Could not sign in. Check that anonymous sign-in is enabled in Supabase.");
  return result.data.user;
}
