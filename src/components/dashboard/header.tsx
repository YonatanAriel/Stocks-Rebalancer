"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { signout } from "@/actions/auth";

export function DashboardHeader({ 
  userEmail, 
  onRefresh,
  isLoading 
}: { 
  userEmail: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10 bg-background/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <span className="text-2xl font-black uppercase tracking-[0.4em] text-primary font-heading text-glow">REBALANCER</span>
            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-40">Quant-Grade Portfolio Terminal</span>
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary font-heading text-glow">Global Terminal</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="h-8 w-px bg-white/10" />
          
          <div className="flex items-center gap-3">
            <ModeToggle />
            <form action={signout}>
              <button 
                type="submit" 
                className="rounded-none text-[10px] uppercase font-black tracking-widest border border-white/10 hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive transition-all h-10 px-6 cursor-pointer"
              >
                Terminate Session
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
