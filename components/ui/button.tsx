import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "highlight";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" && "bg-accent text-white dark:text-ink hover:bg-accent-strong",
        variant === "secondary" && "border border-line bg-bg-elevated text-ink hover:bg-accent-soft",
        variant === "ghost" && "text-ink hover:bg-accent-soft",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "highlight" && "bg-highlight text-[#12201c] hover:brightness-95",
        className,
      )}
      {...props}
    />
  );
}
