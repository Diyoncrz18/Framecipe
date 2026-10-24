import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const LABELS = { "missing-folder": "Terdaftar, folder tidak ada", unregistered: "Belum terdaftar di registry" };

// Registry and folder disagree (catalog item `mismatch`). Icon plus text, never color alone (NFR-10).
export function MismatchBadge({ mismatch }: { mismatch: string | null }) {
  if (!mismatch || !(mismatch in LABELS)) return null;
  return (
    <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900">
      <TriangleAlert aria-hidden="true" />
      {LABELS[mismatch as keyof typeof LABELS]}
    </Badge>
  );
}
