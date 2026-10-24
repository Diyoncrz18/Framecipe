import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { RUN_STATUSES } from "@/core/contracts.mjs";
import { STATUS_LABELS } from "@/core/labels.mjs";
import { listProjects } from "@/core/projects.mjs";
import { flowName } from "@/lib/flow-name";
import { ROOT } from "@/lib/root";

const SELECT = "h-8 rounded-lg border border-input bg-transparent px-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const alur = first(sp.alur);
  const status = first(sp.status);

  const all = listProjects(ROOT);
  const flows = [...new Set(all.map((p) => p.flow).filter((f): f is string => !!f))].sort().map((id) => ({ id, name: flowName(id) }));
  const names = new Map(flows.map((f) => [f.id, f.name]));
  // A broken project always shows: it is something to fix, not a result to filter out.
  const shown = all.filter((p) => p.corrupt
    || ((!alur || (alur === "tanpa" ? !p.flow : p.flow === alur)) && (!status || p.latestStatus === status)));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Video</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-alur" className="text-sm font-medium">Alur</label>
          <select id="filter-alur" name="alur" defaultValue={alur} className={SELECT}>
            <option value="">Semua alur</option>
            <option value="tanpa">Tanpa alur</option>
            {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-status" className="text-sm font-medium">Status</label>
          <select id="filter-status" name="status" defaultValue={status} className={SELECT}>
            <option value="">Semua status</option>
            {RUN_STATUSES.map((s: string) => <option key={s} value={s}>{STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</option>)}
          </select>
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          {all.length === 0 ? "Belum ada video. Buat dari Beranda atau halaman Alur." : "Tidak ada video yang cocok dengan filter."}
        </p>
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
          {shown.map((p) => (
            <li key={p.slug} className="grid">
              <VideoCard project={p} flowName={p.flow ? names.get(p.flow) ?? p.flow : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
