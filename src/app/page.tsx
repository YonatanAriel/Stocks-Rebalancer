import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center gap-8">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl glass glow-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-primary"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Rebalancer
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Know exactly how to invest your new cash to keep your portfolio
            perfectly balanced. Built especially for long‑term TASE investors.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Get Started
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Free &amp; open source. Your data stays yours.
        </p>
      </div>
    </main>
  );
}
