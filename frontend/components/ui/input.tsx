"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { className?: string }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn("px-3 py-2 rounded border border-border bg-transparent text-sm w-full", className)} {...props} />
})
Input.displayName = "Input"
