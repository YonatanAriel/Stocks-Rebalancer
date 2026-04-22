"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-10 border border-white/10" />;

  return (
    <button
      className="rounded-none border-white/10 bg-background/50 hover:bg-primary/10 transition-all group h-10 w-10 cursor-pointer pointer-events-auto border border-white/10 flex items-center justify-center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
