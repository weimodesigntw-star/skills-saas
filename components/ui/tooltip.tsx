"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const TooltipContext = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

function Tooltip({ children, delayDuration = 300 }: { children: React.ReactNode; delayDuration?: number }) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(function TooltipTrigger({ children, asChild, ...props }, ref) {
  const { setOpen } = React.useContext(TooltipContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onMouseEnter?: () => void; onMouseLeave?: () => void }>, {
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
    });
  }
  return (
    <button
      ref={ref}
      type="button"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </button>
  );
});

function TooltipContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(TooltipContext);
  if (!open) return null;
  return (
    <div
      className={cn("absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md", className)}
      {...props}
    />
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
