import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { ArrowLeft, Lock, Mail, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { auth } from "@/lib/firebase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(from ?? "/app", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">Welcome back</h1>
      <p className="mt-2 text-stone-500">Sign in to your Waste Not Kitchen account.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              required
              leading={<Mail className="size-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              required
              leading={<Lock className="size-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-900">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-stone-500">
        New here?{" "}
        <Link to="/register" className="font-medium text-brand-700 hover:text-brand-900">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Don't reveal whether an account exists for this address.
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <AuthLayout>
      <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      {sent ? (
        <div className="mt-8">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <MailCheck className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-stone-500">
            If an account exists for <span className="font-medium text-stone-800">{email}</span>, we've sent a link to
            reset your password.
          </p>
        </div>
      ) : (
        <>
          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-stone-500">Enter your email and we'll send you a reset link.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  required
                  autoComplete="email"
                  leading={<Mail className="size-4" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
