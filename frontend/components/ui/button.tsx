"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string; className?: string }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, children, ...props }, ref) => {
  return (
    <button ref={ref} className={cn("px-3 py-2 rounded inline-flex items-center justify-center", className)} {...props}>
      {children}
    </button>
  )
})
Button.displayName = "Button"
