import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-action-primary text-white hover:bg-action-hover",
    secondary: "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-elevated",
    ghost: "text-text-primary hover:bg-bg-elevated",
    danger: "bg-error text-white hover:opacity-90",
  };
  return <button className={cn(base, styles[variant], className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-active focus:outline-none",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(
        "w-full rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-active focus:outline-none resize-y",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-md border border-border-default bg-bg-base px-3 py-1.5 text-sm text-text-primary focus:border-border-active focus:outline-none",
        props.className
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-lg bg-bg-surface ring-1 ring-border-default", className)}>{children}</div>;
}
