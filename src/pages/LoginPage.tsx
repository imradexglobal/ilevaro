import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn, resetPassword } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { APP_NAME, TAGLINE } from "@/lib/constants";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (resetMode) {
        await resetPassword(email);
        toast.success("Password reset email sent. Check your inbox.");
        setResetMode(false);
      } else {
        await signIn(email, password);
        toast.success("Signed in successfully.");
        navigate("/dashboard");
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes("auth/invalid-credential")
          ? "Invalid email or password."
          : err instanceof Error && err.message.includes("auth/invalid-email")
            ? "Please enter a valid email address."
            : err instanceof Error && err.message.includes("auth/too-many-requests")
              ? "Too many attempts. Please wait and try again."
              : "Authentication failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            I
          </div>
          <p className="mt-8 text-3xl font-bold text-white">{APP_NAME}</p>
          <p className="mt-2 text-lg text-slate-400">{TAGLINE}</p>
        </div>
        <div className="space-y-4 text-sm text-slate-400">
          <p>Multi-tenant property management for Nigerian agencies.</p>
          <p>Manage properties, tenancies, rent, payments, and reports — all in one place.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              I
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900">{APP_NAME}</p>
          </div>

          <h2 className="mt-6 text-xl font-semibold text-slate-900">
            {resetMode ? "Reset your password" : "Sign in to your account"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {resetMode
              ? "Enter your email and we'll send a reset link."
              : "Enter your credentials to continue."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
            />

            {!resetMode && (
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {resetMode ? "Send reset email" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              onClick={() => {
                setResetMode(!resetMode);
                setError("");
              }}
              className="text-brand-600 hover:text-brand-700"
            >
              {resetMode ? "Back to sign in" : "Forgot password?"}
            </button>
            {!resetMode && (
              <Link to="/register" className="text-brand-600 hover:text-brand-700">
                Create an account
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
