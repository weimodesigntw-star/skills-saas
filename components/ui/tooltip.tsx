"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// ============================================
// Lightweight Tooltip (no Radix dependency)
// Uses CSS-only positioning + React state
// ============================================

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

interface TooltipProps {
  children: React.ReactNode
  delayDuration?: number
}

interface TooltipContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  delayDuration: number
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
  delayDuration: 300,
})

function Tooltip({ children, delayDuration = 300 }: TooltipProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  )
}

const TooltipTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
  const { setOpen, delayDuration } = React.useContext(TooltipContext)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => setOpen(true), delayDuration)
  }

  const handleLeave = () => {
    clearTimeout(timeoutRef.current)
    setOpen(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onMouseEnter: handleEnter,
      onMouseLeave: handleLeave,
      onFocus: handleEnter,
      onBlur: handleLeave,
      ref,
      ...props,
    })
  }

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      {...props}
    >
      {children}
    </div>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", sideOffset = 4, children, ...props }, ref) => {
    const { open } = React.useContext(TooltipContext)

    if (!open) return null

    const positionClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
      left: "right-full top-1/2 -translate-y-1/2 mr-1",
      right: "left-full top-1/2 -translate-y-1/2 ml-1",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95",
          positionClasses[side],
          className
        )}
        style={{ marginTop: side === 'bottom' ? sideOffset : undefined, marginBottom: side === 'top' ? sideOffset : undefined }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
