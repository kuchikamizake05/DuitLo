import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.985] sm:min-h-11 sm:active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-[var(--brand-primary)] text-white shadow-[var(--shadow-action)] hover:shadow-md",
        secondary: "border border-[var(--border-subtle)] bg-[var(--surface)] text-slate-700 shadow-[var(--shadow-control)] hover:shadow-md",
        ghost: "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800",
        destructive: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      },
      size: {
        default: "min-h-12 px-4 sm:min-h-11",
        compact: "min-h-10 rounded-full px-3 py-2 text-xs sm:min-h-9",
        icon: "h-12 w-12 shrink-0 px-0 sm:h-11 sm:w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);
