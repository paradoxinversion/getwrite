import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AuthScreen from "../components/Auth/AuthScreen";

describe("AuthScreen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders login mode by default", () => {
    render(<AuthScreen />);
    expect(
      screen.getByRole("tab", { name: "Log in", selected: true }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(screen.queryByText(/name/i)).toBeNull();
  });

  it("toggling to signup mode changes the form", () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
  });

  it("does not ask for a name at signup (collect the least personal info)", () => {
    render(<AuthScreen />);
    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.queryByText("Name")).toBeNull();
    expect(screen.queryByLabelText("Name", { exact: false })).toBeNull();
  });

  it("submits login with entered credentials and redirects on success", async () => {
    const signInEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    const onAuthenticated = vi.fn();
    render(
      <AuthScreen
        signInEmail={signInEmail}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "writer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "writer@example.com",
        password: "correct-horse",
      });
      expect(onAuthenticated).toHaveBeenCalled();
    });
  });

  it("shows the uniform check-your-email message for a new signup", async () => {
    const signUpEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    render(<AuthScreen signUpEmail={signUpEmail} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    // Signs up with an empty name — the UI collects none (better-auth still
    // requires the field to be present).
    await waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith({
        name: "",
        email: "ada@example.com",
        password: "correct-horse",
      }),
    );
    expect(
      screen.getByText(/check your email to verify your account/i),
    ).toBeTruthy();
  });

  it("shows the same uniform message for an existing-email signup response", async () => {
    // better-auth's own anti-enumeration behavior: a successful `signUp.email`
    // call for an existing email looks identical to a new signup at this
    // layer — no `error` is returned either way.
    const signUpEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
    render(<AuthScreen signUpEmail={signUpEmail} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(
        screen.getByText(/check your email to verify your account/i),
      ).toBeTruthy(),
    );
  });

  it("shows a distinct message for an unverified-account login error", async () => {
    const signInEmail = vi
      .fn()
      .mockResolvedValue({
        data: null,
        error: {
          status: 403,
          code: "EMAIL_NOT_VERIFIED",
          message: "Email not verified",
        },
      });
    render(<AuthScreen signInEmail={signInEmail} />);

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(screen.getByText(/please verify your email/i)).toBeTruthy(),
    );
  });

  it("shows the single generic message for wrong-password/no-account login errors", async () => {
    const signInEmail = vi
      .fn()
      .mockResolvedValue({
        data: null,
        error: {
          status: 401,
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        },
      });
    render(<AuthScreen signInEmail={signInEmail} />);

    fireEvent.change(screen.getByLabelText("Email", { exact: false }), {
      target: { value: "someone@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: false }), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid email or password.")).toBeTruthy(),
    );
    expect(screen.queryByText(/please verify/i)).toBeNull();
  });
});
