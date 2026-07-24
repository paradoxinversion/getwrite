"use client";

import React, { useState } from "react";
import Link from "next/link";
import Button from "../common/UI/Button/Button";
import Input from "../common/UI/Input/Input";
import { resetPassword as defaultResetPassword } from "../../src/lib/auth/auth-client";

/**
 * @module Auth/ResetPasswordForm
 *
 * The "set a new password" form behind `app/reset-password/page.tsx`
 * (Slice 6, FR21/FR13). Unlike `/verify-email`, the token here isn't
 * consumed on page load — better-auth's `/reset-password` endpoint is a
 * `POST` that needs a new password from the user, so this is necessarily a
 * client-side form submission (`resetPassword({ newPassword, token })`, the
 * better-auth client action — see `auth-client.ts`'s module doc for why
 * that's the right name, not `forgetPassword`/`changePassword`).
 *
 * `resetPasswordEmail` is an injected prop defaulting to the real
 * `auth-client.ts` action, matching `AuthScreen.tsx`'s pattern — tests and
 * stories can pass a stub without mocking `better-auth/react`.
 */

/**
 * The minimal contract this form needs from the injected reset action:
 * callable with `{ newPassword, token }`, resolving to a result whose
 * (optional) `error` gates the failure message. Intentionally narrower than
 * better-auth's own `typeof resetPassword` — that action type is generic over
 * fetch options and a conditional `throw` return, which no plain async stub
 * can satisfy without an `any` cast. The real client action
 * (`auth-client.ts`) stays assignable, so the default below still type-checks,
 * while tests and stories can inject a stub with no coercion.
 */
type ResetPasswordEmailAction = (params: {
  newPassword: string;
  token: string;
}) => Promise<{ data?: unknown; error?: unknown }>;

export interface ResetPasswordFormProps {
  /** The single-use token from the `/reset-password?token=…` URL. */
  token: string;
  resetPasswordEmail?: ResetPasswordEmailAction;
}

const RESET_FAILURE_MESSAGE =
  "This reset link is invalid or has expired. Request a new one from the login screen.";

export default function ResetPasswordForm({
  token,
  resetPasswordEmail = defaultResetPassword,
}: ResetPasswordFormProps): JSX.Element {
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSucceeded, setSucceeded] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await resetPasswordEmail({ newPassword, token });
      if (result.error) {
        setErrorMessage(RESET_FAILURE_MESSAGE);
        return;
      }
      setSucceeded(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasSucceeded) {
    return (
      <div className="text-center">
        <h1 className="mb-3 font-sans text-gw-h2 text-gw-primary">
          Password updated
        </h1>
        <p className="mb-4 text-gw-body text-gw-secondary">
          Your password has been reset — you can now log in.
        </p>
        <Link
          href="/login"
          className="font-mono text-[10px] uppercase tracking-label-wide text-gw-primary hover:underline"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <h1 className="mb-4 font-sans text-gw-h2 text-gw-primary">
        Set a new password
      </h1>
      <label className="mb-4 block">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
          New password
        </div>
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="w-full"
          disabled={isSubmitting}
        />
      </label>
      {errorMessage ? (
        <div className="mb-3 text-gw-body text-gw-red">{errorMessage}</div>
      ) : null}
      <Button
        type="submit"
        variant="default"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
