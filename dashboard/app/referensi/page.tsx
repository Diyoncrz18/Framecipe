import Link from "next/link";
import { BrandPreview } from "@/components/brand-preview";
import { CopyButton } from "@/components/copy-button";
import type { FlowOption } from "@/components/flow-select";
import { MismatchBadge } from "@/components/mismatch-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseInFlow } from "@/components/use-in-flow";
import { readCatalog, type Catalog } from "@/core/catalog.mjs";
import { loadFlowOptions } from "@/lib/flow-options";
import { mediaUrl } from "@/lib/media";
import { ROOT } from "@/lib/root";

const TABS = [
  { id: "contoh", label: "Contoh" },
  { id: "template", label: "Template" },
  { id: "brand", label: "Brand" },
  { id: "transisi", label: "Transisi" },
  { id: "komponen", label: "Komponen" },
];
const DASH = "—";
const GRID = "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Item({ title, description, badges, children }: { title: string; description?: string; badges?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="grid">
      <Card>
        <CardHeader>
          <CardTitle className="break-words">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
          {children}
        </CardContent>
      </Card>
    </li>
  );
}

function Examples({ items, flows }: { items: Catalog["examples"]; flows: FlowOption[] }) {
  return items.map((e) => (
    <Item
      key={e.id}
      title={e.id}
      description={e.description}
      badges={<>
        <Badge variant="secondary">Template: {e.template ?? DASH}</Badge>
        <Badge variant="outline">Kompleksitas: {e.complexity ?? DASH}</Badge>
        <MismatchBadge mismatch={e.mismatch} />
      </>}
    >
      {e.renderedVideo ? (
        <video src={mediaUrl(e.renderedVideo)} controls preload="metadata" aria-label={`Video contoh ${e.id}`} className="aspect-video w-full bg-muted" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Belum di-render{e.mismatch === "missing-folder" && ". Folder contoh tidak ada."}</span>
          {/* There is no folder to cd into when the registry lists an example that is not in examples/. */}
          {e.mismatch !== "missing-folder" && <CopyButton text={`cd examples/${e.id} && npm install && npm run render`} />}
        </div>
      )}
      {/* A flow can only use what sits on disk, like the flow editor's picker. */}
      {e.source !== "registry" && <UseInFlow kind="example" id={e.id} flows={flows} />}
    </Item>
  ));
}

function Templates({ items, flows }: { items: Catalog["templates"]; flows: FlowOption[] }) {
  return items.map((t) => (
    <Item
      key={t.id}
      title={t.id}
      description={t.description}
      badges={<>
        <Badge variant="outline">Status: {t.status ?? DASH}</Badge>
        <Badge variant="secondary">{t.engine === "remotion" ? "Remotion" : "Python"}</Badge>
        {t.engine !== "remotion" && <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900">Belum bisa dipakai di alur v1</Badge>}
      </>}
    >
      <p className="text-sm">
        Rasio {t.aspectRatio === "unknown" ? DASH : t.aspectRatio} · {t.width && t.height ? `${t.width}×${t.height}` : DASH}
      </p>
      {t.source !== "registry" && <UseInFlow kind="template" id={t.id} flows={flows} />}
    </Item>
  ));
}

function Brands({ items, flows }: { items: Catalog["brands"]; flows: FlowOption[] }) {
  // A broken brand.json shows as its own item; the other brands are unaffected (NFR-07).
  return items.map((b) => {
    if (!b.brand) return <Item key={b.id} title={b.corrupt ? "Data rusak" : b.id} description={`Folder: brands/${b.id}`} />;
    const name = typeof b.brand.name === "string" ? b.brand.name : b.id;
    return (
      <Item key={b.id} title={name} description={b.description}>
        <BrandPreview name={name} brand={b.brand} logo={b.logo} />
        <UseInFlow kind="brand" id={b.id} flows={flows} />
      </Item>
    );
  });
}

function Transitions({ items, flows }: { items: Catalog["transitions"]; flows: FlowOption[] }) {
  return items.map((t) => (
    <Item key={t.id} title={t.id} description={t.description}>
      <dl className="flex flex-col gap-1 text-sm">
        <div><dt className="inline font-medium">Opsi: </dt><dd className="inline">{Array.isArray(t.options) && t.options.length ? t.options.join(", ") : DASH}</dd></div>
        <div><dt className="inline font-medium">Cocok untuk: </dt><dd className="inline">{t.bestFor ?? DASH}</dd></div>
      </dl>
      <UseInFlow kind="transition" id={t.id} flows={flows} />
    </Item>
  ));
}

function Components({ items, flows }: { items: Catalog["components"]; flows: FlowOption[] }) {
  return items.map((c) => (
    <Item key={c.id} title={c.id} description={c.description}>
      <p className="break-all font-mono text-xs text-muted-foreground">{c.path}</p>
      <UseInFlow kind="component" id={c.id} flows={flows} />
    </Item>
  ));
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const requested = first(sp.tab);
  const tab = TABS.some((t) => t.id === requested) ? requested : "contoh";
  const catalog = readCatalog(ROOT);
  const flows = loadFlowOptions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Referensi Desain</h1>
      {catalog.registryError && <p role="alert" className="text-sm text-destructive">Registry bermasalah: {catalog.registryError}</p>}

      <nav aria-label="Jenis referensi">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/referensi?tab=${t.id}`}
                aria-current={t.id === tab ? "page" : undefined}
                className="block rounded-md px-3 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ul className={GRID}>
        {tab === "contoh" && <Examples items={catalog.examples} flows={flows} />}
        {tab === "template" && <Templates items={catalog.templates} flows={flows} />}
        {tab === "brand" && <Brands items={catalog.brands} flows={flows} />}
        {tab === "transisi" && <Transitions items={catalog.transitions} flows={flows} />}
        {tab === "komponen" && <Components items={catalog.components} flows={flows} />}
      </ul>
    </div>
  );
}
