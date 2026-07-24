"use client";

import React, { useState } from "react";
import Button from "../common/UI/Button/Button";
import Input from "../common/UI/Input/Input";
import {
  signIn as defaultSignIn,
  signUp as defaultSignUp,
  requestPasswordReset as defaultRequestPasswordReset,
} from "../../src/lib/auth/auth-client";

/**
 * @module Auth/AuthScreen
 *
 * The client login/signup/forgot-password UI for Slice 6 (FR21,
 * `specs/features/auth-provider.md`). Mounted at `app/login/page.tsx`.
 * Covers login → signup → "check your email" → forgot-password in one
 * brand-styled component, toggled by `mode` state — there is no
 * `/signup` or `/forgot-password` route, per the plan's "login/signup
 * toggle, verify prompt, reset" scoping for this single screen.
 *
 * **Auth actions are injected props with real defaults**, not hardcoded
 * calls into `auth-client.ts` — `signInEmail`/`signUpEmail`/
 * `requestPasswordResetEmail` default to the real better-auth client
 * actions (`auth-client.ts`) so production code needs no wiring, but tests
 * and Storybook stories can pass stub implementations without mocking the
 * `better-auth/react` module graph.
 *
 * **FR11 — distinguishing "unverified" from every other login failure.**
 * Verified directly against the installed `better-auth@1.6.24` runtime
 * (`api/routes/sign-in.mjs`): an unverified account's sign-in attempt
 * throws `APIError.from("FORBIDDEN", BASE_ERROR_CODES.EMAIL_NOT_VERIFIED)`,
 * which `@better-auth/core`'s `defineErrorCodes` turns into an error object
 * whose `code` field is the literal string `"EMAIL_NOT_VERIFIED"` — every
 * other login failure (no such account, wrong password) instead throws
 * `APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD)`
 * (`code: "INVALID_EMAIL_OR_PASSWORD"`). `handleLogin` below checks
 * `error.code === "EMAIL_NOT_VERIFIED"` specifically and shows a distinct,
 * actionable message only for that case; every other failure — including
 * an entirely unrecognized error shape — falls through to the single
 * generic "Invalid email or password." message, so login itself never
 * distinguishes "no account" from "wrong password" (FR15, which this
 * component consumes rather than changes: better-auth's login endpoint
 * already returns a uniform `UNAUTHORIZED`/`INVALID_EMAIL_OR_PASSWORD` for
 * both cases).
 *
 * **FR15 — signup response is always the uniform "check your email"
 * message.** Verified against `api/routes/sign-up.mjs`: with
 * `requireEmailVerification: true` (`auth-server.ts`), an existing-email
 * signup attempt returns a normal-looking `200` with a synthetic user
 * rather than a distinguishing error, so a successful `signUp.email(...)`
 * call — new account or existing email alike — always lands in the same
 * "check your email to verify your account" state below. The
 * invite/allowlist rejection (`auth-server.ts`'s `databaseHooks.user.create.before`
 * returning `false`, surfaced as a generic `BAD_REQUEST`) is the one signup
 * failure this component does distinguish, with a non-revealing message
 * ("Signup isn't available for this email right now.") — FR12's scope,
 * not FR15-grade indistinguishability.
 */

type Mode = "login" | "signup" | "forgot-password";

/**
 * The minimal contracts `AuthScreen` needs from its injected auth actions:
 * each is callable with the relevant fields and resolves to a result whose
 * (optional) `error` this component reads.
 *
 * These are intentionally narrower than better-auth's own client-action types
 * (`typeof signIn.email` et al.), which are generic over fetch options and a
 * conditional `throw` return — a shape no plain async stub can satisfy without
 * an `any` cast. Narrowing to exactly what's consumed makes the injectable-
 * action design (FR21) work as intended: tests and Storybook stories can pass
 * ordinary stubs with no coercion, while the real client actions
 * (`auth-client.ts`) remain assignable, so the production defaults below still
 * type-check.
 */
type SignInEmailAction = (params: {
  email: string;
  password: string;
}) => Promise<{ data?: unknown; error?: { code?: string } | null }>;

type SignUpEmailAction = (params: {
  name: string;
  email: string;
  password: string;
}) => Promise<{ data?: unknown; error?: unknown }>;

type RequestPasswordResetAction = (params: {
  email: string;
  redirectTo?: string;
}) => Promise<unknown>;

export interface AuthScreenProps {
  /** Called after a successful login. Defaults to a full-page redirect to `/`. */
  onAuthenticated?: () => void;
  signInEmail?: SignInEmailAction;
  signUpEmail?: SignUpEmailAction;
  requestPasswordResetEmail?: RequestPasswordResetAction;
}

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const UNVERIFIED_LOGIN_ERROR =
  "Please verify your email — check your inbox for a verification link before signing in.";
const SIGNUP_UNAVAILABLE_ERROR =
  "Signup isn't available for this email right now.";
const SIGNUP_SUCCESS_MESSAGE =
  "Check your email to verify your account before signing in.";
const RESET_REQUESTED_MESSAGE =
  "If that email has an account, check your inbox for a password-reset link.";

function redirectToApp(): void {
  window.location.assign("/");
}

export default function AuthScreen({
  onAuthenticated = redirectToApp,
  signInEmail = defaultSignIn.email,
  signUpEmail = defaultSignUp.email,
  requestPasswordResetEmail = defaultRequestPasswordReset,
}: AuthScreenProps): JSX.Element {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  function switchMode(nextMode: Mode): void {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleLogin(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const result = await signInEmail({ email, password });
      if (result.error) {
        setErrorMessage(
          result.error.code === "EMAIL_NOT_VERIFIED"
            ? UNVERIFIED_LOGIN_ERROR
            : GENERIC_LOGIN_ERROR,
        );
        return;
      }
      onAuthenticated();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      // We intentionally collect no name at signup — capture the least personal
      // information possible. better-auth's schema requires the `name` field to
      // be present (and the column is NOT NULL), so send an empty string rather
      // than prompting for one. How/whether to capture a display name later is
      // an open product decision.
      const result = await signUpEmail({ name: "", email, password });
      if (result.error) {
        setErrorMessage(SIGNUP_UNAVAILABLE_ERROR);
        return;
      }
      // Uniform for both a genuinely new account and an existing email
      // (FR15) — better-auth's own signup response is already
      // indistinguishable between the two when it succeeds.
      setInfoMessage(SIGNUP_SUCCESS_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await requestPasswordResetEmail({ email, redirectTo: "/reset-password" });
      // Always the same message regardless of whether the account exists
      // (FR15) — better-auth's request-password-reset endpoint already
      // responds uniformly.
      setInfoMessage(RESET_REQUESTED_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gw-chrome1 px-4">
      <div className="w-full max-w-sm border border-gw-border bg-gw-chrome2 p-6">
        <div className="mb-5 text-center">
          <span aria-label="GetWrite" className="font-display text-gw-h2">
            <span className="font-normal tracking-heading text-gw-secondary">
              Get
            </span>
            <span className="font-bold tracking-wordmark text-gw-primary">
              Write
            </span>
          </span>
        </div>

        {mode !== "forgot-password" ? (
          <div
            role="tablist"
            aria-label="Login or signup"
            className="mb-5 flex border border-gw-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-label-wide ${
                mode === "login"
                  ? "bg-gw-chrome3 text-gw-primary"
                  : "text-gw-secondary"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 font-mono text-[10px] uppercase tracking-label-wide ${
                mode === "signup"
                  ? "bg-gw-chrome3 text-gw-primary"
                  : "text-gw-secondary"
              }`}
            >
              Sign up
            </button>
          </div>
        ) : (
          <h1 className="mb-5 font-sans text-gw-h2 text-gw-primary">
            Reset password
          </h1>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} aria-busy={isSubmitting}>
            <label className="mb-3 block">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
                Email
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                disabled={isSubmitting}
              />
            </label>
            <label className="mb-3 block">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
                Password
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                disabled={isSubmitting}
              />
            </label>
            <button
              type="button"
              onClick={() => switchMode("forgot-password")}
              className="mb-4 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary hover:text-gw-primary"
            >
              Forgot password?
            </button>
            {errorMessage ? (
              <div className="mb-3 text-gw-body text-gw-red">
                {errorMessage}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Log in"}
            </Button>
          </form>
        ) : null}

        {mode === "signup" ? (
          <form onSubmit={handleSignup} aria-busy={isSubmitting}>
            <label className="mb-3 block">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
                Email
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                disabled={isSubmitting}
              />
            </label>
            <label className="mb-4 block">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
                Password
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                disabled={isSubmitting}
              />
            </label>
            {errorMessage ? (
              <div className="mb-3 text-gw-body text-gw-red">
                {errorMessage}
              </div>
            ) : null}
            {infoMessage ? (
              <div className="mb-3 text-gw-body text-gw-primary">
                {infoMessage}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing up…" : "Sign up"}
            </Button>
          </form>
        ) : null}

        {mode === "forgot-password" ? (
          <form onSubmit={handleForgotPassword} aria-busy={isSubmitting}>
            <label className="mb-4 block">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary">
                Email
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                disabled={isSubmitting}
              />
            </label>
            {infoMessage ? (
              <div className="mb-3 text-gw-body text-gw-primary">
                {infoMessage}
              </div>
            ) : null}
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="mt-4 block font-mono text-[10px] uppercase tracking-label-wide text-gw-secondary hover:text-gw-primary"
            >
              Back to log in
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
