import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg" | "default";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[#4A90E2] text-white hover:bg-[#2C5F8D]": variant === "default",
            "border border-[#6BA3E8] bg-white text-[#1E3A5F] hover:bg-[#E8F4FD]":
              variant === "outline",
            "hover:bg-[#E8F4FD] text-[#1E3A5F]": variant === "ghost",
            "h-9 px-4 text-sm": size === "sm",
            "h-14 px-8 text-lg": size === "lg",
            "h-10 px-4 text-base": size === "default",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
