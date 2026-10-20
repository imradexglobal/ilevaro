import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "@/lib/auth";
import { createAgencyForUser } from "@/lib/agency";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { APP_NAME, NIGERIAN_STATES } from "@/lib/constants";

export function RegisterPage() {
  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const user = await signUp(email, password, fullName);
      if (!user) {
        setError("Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Agency is created as part of signup, so the owner lands on a working
      // dashboard instead of a separate setup step.
      await createAgencyForUser(user, {
        agencyName,
        email,
        phone,
        state,
      });

      toast.success("Account created. Welcome to ILEVARO!");
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("auth/email-already-in-use")) {
          setError("An account with this email already exists.");
        } else if (err.message.includes("auth/weak-password")) {
          setError("Password is too weak. Use at least 8 characters.");
        } else {
          setError("Registration failed. Please try again.");
        }
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
            I
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Create your agency account</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Register your agency</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start managing properties, tenants, and rent collection.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <Input
              label="Agency name"
              required
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Acme Properties Ltd"
            />

            <Input
              label="Your full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Okafor"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.com"
              />
              <Input
                label="Phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08012345678"
              />
            </div>

            <Select
              label="State"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              options={[
                { value: "", label: "Select your state" },
                ...NIGERIAN_STATES.map((s) => ({ value: s, label: s })),
              ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters"
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
