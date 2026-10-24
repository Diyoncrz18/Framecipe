"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { addReferenceAction } from "@/app/referensi/actions";
import { FlowSelect, type FlowOption } from "@/components/flow-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Outcome = { ok: true; text: string } | { ok: false; errors: string[] };

// Adds this catalog item as a reference of the chosen flow (the flow's version goes up by one).
export function UseInFlow({ kind, id, flows }: { kind: string; id: string; flows: FlowOption[] }) {
  const uid = useId();
  const [flow, setFlow] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function add() {
    setPending(true);
    setOutcome(null);
    try {
      const r = await addReferenceAction(flow, { kind, id });
      const name = flows.find((f) => f.id === flow)?.name ?? flow;
      setOutcome(r.ok ? { ok: true, text: `${r.added ? "Ditambahkan ke" : "Sudah ada di"} ${name} (versi ${r.version})` } : r);
    } catch {
      setOutcome({ ok: false, errors: ["Gagal menambahkan. Coba lagi."] });
    }
    setPending(false);
  }

  if (flows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada alur untuk dipakai.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${uid}-flow`}>Alur<span className="sr-only"> untuk {id}</span></Label>
          <FlowSelect id={`${uid}-flow`} flows={flows} value={flow} onChange={(v) => { setFlow(v); setOutcome(null); }} />
        </div>
        <Button type="button" variant="outline" disabled={!flow || pending} onClick={add}>Pakai di alur</Button>
      </div>
      {/* Always in the accessibility tree: empty, it is taken out of the layout (so no gap) but never display:none. */}
      <div role="status" className="text-sm empty:sr-only">
        {outcome?.ok && <p className="flex items-center gap-1.5 text-green-800"><CircleCheck aria-hidden="true" className="size-4 shrink-0" />{outcome.text}</p>}
      </div>
      {outcome && !outcome.ok && (
        <div role="alert" className="text-sm text-destructive">
          {outcome.errors.map((m, i) => <p key={i} className="flex items-start gap-1.5"><CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{m}</p>)}
        </div>
      )}
    </div>
  );
}
