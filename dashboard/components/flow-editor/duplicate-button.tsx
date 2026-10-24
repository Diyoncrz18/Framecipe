"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Disabled while the duplicate is being made, so a double click cannot create both -salinan and -salinan-2.
export function DuplicateButton({ name, disabled }: { name: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={disabled || pending} aria-label={`Duplikat alur ${name}`}>Duplikat</Button>
  );
}
