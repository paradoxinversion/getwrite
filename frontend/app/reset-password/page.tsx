import Link from "next/link";
import ResetPasswordForm from "../../components/Auth/ResetPasswordForm";
import { isHostedAuthActive } from "../../src/lib/auth/auth-config";

/**
 * `/reset-password` — the "set a new password" page (Slice 6, FR13).
 *
 * **The token arrives as a query parameter, not a path segment.** better-auth's
 * reset email links to `${baseURL}/reset-password/<token>?callbackURL=<redirectTo>`
 * (its own GET endpoint under `/api/auth`); that endpoint validates the token and
 * **redirects the browser to `<redirectTo>?token=<token>`** — i.e. to
 * `/reset-password?token=…` (see `better-auth`'s `password.mjs` reset flow, and
 * the `redirectTo: "/reset-password"` passed from `AuthScreen`). This page must
 * therefore read the token from `searchParams`. An earlier `[token]` path-segment
 * route 404'd every real reset link because better-auth never sends the token as a
 * path segment to the callback — the FR26 review's H1 finding.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<JSX.Element> {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gw-chrome1 px-4">
      <div className="w-full max-w-sm border border-gw-border bg-gw-chrome2 p-6">
        {!isHostedAuthActive() ? (
          <p className="text-center text-gw-body text-gw-secondary">
            Accounts aren&apos;t used in this build of GetWrite.
          </p>
        ) : token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="text-center">
            <h1 className="mb-3 font-sans text-gw-h2 text-gw-primary">
              Invalid reset link
            </h1>
            <p className="mb-4 text-gw-body text-gw-secondary">
              This password-reset link is missing its token. Request a new one
              from the login screen.
            </p>
            <Link
              href="/login"
              className="font-mono text-[10px] uppercase tracking-label-wide text-gw-primary hover:underline"
            >
              Go to log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
