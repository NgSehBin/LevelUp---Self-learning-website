"use client"

import * as React from "react"

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & { className?: string }

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} {...props} className={className} role="region" aria-label="scroll-area">
        {children}
      </div>
    )
  }
)

ScrollArea.displayName = "ScrollArea"
