"use client";

import { useState, useEffect } from "react";
import { Menu, Search, RefreshCw, X, Plus, Calculator, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { signout } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export function DashboardHeader({ 
  userEmail, 
  onRefresh,
  isLoading,
  onRebalance,
  onAllocation,
  onSearch
}: { 
  userEmail: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  onNewAsset?: () => void;
  onRebalance?: () => void;
  onAllocation?: () => void;
  onSearch?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const themeLabel = !mounted ? "Switch to Dark" : (theme === "dark" ? "Switch to Light" : "Switch to Dark");

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/10 dark:border-white/10 bg-background/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 mobile:h-20 max-w-6xl items-center justify-between px-6">
          {/* Left: Logo + Global Terminal grouped together */}
          <div className="flex items-center gap-2">
            <Image src="/logo light mode.svg" alt="Rebalancer Logo" width={47} height={47} className="flex-shrink-0 mb-[-3px]  dark:hidden" />
            <Image src="/logo dark mode.svg" alt="Rebalancer Logo" width={47} height={47} className="flex-shrink-0 mb-[-3px]  hidden dark:block" />
            {/* Desktop: Show full branding */}
            <div className="hidden sm-mobile:flex flex-col">
              <span className="text-2xl font-black uppercase tracking-[0.4em] text-primary font-heading text-glow">REBALANCER</span>
              <span className="text-[8px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-40">Quant-Grade Portfolio Terminal</span>
            </div>
            
            <div className="hidden lg:flex items-center gap-8">
              <div className=" ml-1 h-8 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary font-heading text-glow">Global Terminal</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 flex-1 mobile:flex-initial justify-end">
            {/* Mobile: Search bar that expands in available space */}
            <div className="flex mobile:hidden items-center flex-1 justify-end gap-2 min-w-0">
              {/* Spacer - reduced to minimize empty space */}
              <div className={`transition-all duration-300 ${searchOpen ? 'w-2 xs:w-4 sm:w-8' : 'w-0'}`} />
              
              {/* Search button that expands into search bar */}
              <div className={`relative flex items-center justify-end border border-border rounded-none transition-all duration-300 ease-in-out overflow-hidden h-10 flex-1 ${searchOpen ? 'max-w-[600px] border-primary bg-background/50' : 'max-w-[40px] hover:border-primary/50 hover:bg-primary/5'}`}>
                <div className={`absolute left-0 top-0 bottom-0 flex items-center transition-all duration-300 ease-in-out ${searchOpen ? 'w-[calc(100%-40px)] opacity-100 pl-3' : 'w-0 opacity-0 pl-0'}`}>
                  <div className="relative flex items-center w-full min-w-[150px]">
                    <Input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        window.dispatchEvent(new CustomEvent('mobile-search', { detail: e.target.value }));
                        onSearch?.();
                      }}
                      placeholder="Search..."
                      className="h-10 bg-transparent border-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0 w-full"
                      autoFocus={searchOpen}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchOpen(false);
                        setSearchQuery("");
                        window.dispatchEvent(new CustomEvent('mobile-search', { detail: "" }));
                      }}
                      className={`absolute right-2 transition-all duration-300 ${searchOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={() => setSearchOpen(true)}
                  className="relative z-10 h-10 w-10 flex items-center justify-center hover:text-primary transition-colors cursor-pointer flex-shrink-0"
                  title="Search"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
              
              {/* Show refresh button on screens > 400px */}
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="hidden xs:flex h-10 w-10 rounded-none items-center justify-center border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => setDrawerOpen(true)}
                className="h-10 w-10 rounded-none flex items-center justify-center border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer flex-shrink-0"
                title="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            {/* Desktop: Full buttons */}
            <div className="hidden mobile:flex items-center gap-3">
              <div className="h-8 w-px bg-border" />
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-10 w-10 rounded-none flex items-center justify-center border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </button>
              <form action={signout}>
                <button 
                  type="submit" 
                  className="rounded-none text-[10px] uppercase font-black tracking-widest border border-border hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive transition-all h-10 px-6 cursor-pointer whitespace-nowrap"
                >
                  Terminate Session
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div 
        className={`fixed inset-0 z-[60] mobile:hidden ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        onClick={() => setDrawerOpen(false)}
      >
        {/* Backdrop */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-150 ${drawerOpen ? "opacity-100" : "opacity-0"}`} />
        
        {/* Drawer */}
        <div 
          className={`absolute top-0 right-0 h-full w-80 max-w-[85vw] bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3">
              <Image src="/logo light mode.svg" alt="Logo" width={24} height={24} className="flex-shrink-0 dark:hidden" />
              <Image src="/logo dark mode.svg" alt="Logo" width={24} height={24} className="flex-shrink-0 hidden dark:block" />
              <span className="text-sm font-black uppercase tracking-widest text-primary">Menu</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-10 w-10 rounded-none flex items-center justify-center border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
            {/* Refresh (only on screens ≤ 400px) */}
            <button
              onClick={() => {
                onRefresh?.();
                setDrawerOpen(false);
              }}
              disabled={isLoading}
              className="xs:hidden flex items-center gap-4 w-full p-4 rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 text-primary ${isLoading ? 'animate-spin' : ''}`} />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest">Refresh</span>
                <span className="text-xs text-muted-foreground">Update prices</span>
              </div>
            </button>

            {/* Target Allocation (only on mobile - below 1360px) */}
            <button
              onClick={() => {
                onAllocation?.();
                setDrawerOpen(false);
              }}
              className="portfolio:hidden flex items-center gap-4 w-full p-4 rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest">Target Allocation</span>
                <span className="text-xs text-muted-foreground">View distribution</span>
              </div>
            </button>

            {/* Rebalance */}
            <button
              onClick={() => {
                onRebalance?.();
                setDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-4 rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <Calculator className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest">Rebalance</span>
                <span className="text-xs text-muted-foreground">Calculate allocation</span>
              </div>
            </button>

            <div className="h-px bg-border my-2" />

            {/* Theme Toggle */}
            <button
              onClick={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-4 rounded-none border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
            >
              <div className="relative h-5 w-5">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute top-0 left-0 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase tracking-widest">Theme</span>
                <span className="text-xs text-muted-foreground capitalize">{themeLabel}</span>
              </div>
            </button>
          </div>

          {/* Bottom Section: User Info + Terminate Session - Fixed at bottom */}
          <div className="border-t border-border flex-shrink-0">
            <div className="p-6 space-y-3">
              {/* User Info */}
              <div className="text-xs text-muted-foreground space-y-1 pb-3 border-b border-border">
                <div className="font-black uppercase tracking-widest">Logged in as</div>
                <div className="text-primary truncate">{userEmail}</div>
              </div>

              {/* Terminate Session */}
              <form action={signout} className="w-full">
                <button
                  type="submit"
                  className="flex items-center gap-4 w-full p-4 rounded-none border border-border hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive transition-all text-left"
                >
                  <LogOut className="h-5 w-5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-widest">Terminate Session</span>
                    <span className="text-xs text-muted-foreground">Sign out</span>
                  </div>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
