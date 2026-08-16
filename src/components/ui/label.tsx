import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
