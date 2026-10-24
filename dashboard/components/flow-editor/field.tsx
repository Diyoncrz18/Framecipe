import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Same look as the native filter selects on /video.
export const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

// A label above a control. A hint gets the id `${htmlFor}-hint`; the control points at it with aria-describedby.
export function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type Option = { value: string; label: string; disabled?: boolean };

// A native select: labelled by <label for>, fully keyboard-operable, and a disabled <option> is exactly what the template list needs.
export function NativeSelect({ value, options, onChange, className, ...props }: Omit<ComponentProps<"select">, "value" | "onChange"> & { value: string; options: Option[]; onChange: (value: string) => void }) {
  // A value the list does not know (a hand-edited flow) stays visible instead of silently showing the first option.
  const known = options.some((o) => o.value === value);
  return (
    <select {...props} value={value} onChange={(e) => onChange(e.target.value)} className={cn(SELECT_CLASS, className)}>
      {!known && <option value={value}>{value ? `${value} (tidak ditemukan)` : "Pilih…"}</option>}
      {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  );
}
