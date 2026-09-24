import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Logo } from "@/components/ui";

export function Suspended() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-16" />
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <ShieldAlert className="size-7" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Your account is suspended</h1>
      <p className="mt-3 max-w-md text-stone-500">
        An administrator has paused access to this account. If you think this is a mistake, contact the Waste Not
        Kitchen team.
      </p>
      <Button variant="secondary" className="mt-8" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}
