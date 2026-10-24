import { mediaUrl } from "@/lib/media";

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
// brand.json is hand-edited, so every field is checked before it is rendered (NFR-07).
const strings = (v: unknown): [string, string][] => (isObj(v) ? Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string") : []);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const SCALE = 0.5;
const TYPE_STYLES = ["h1", "h2", "h3", "body", "label"];

export function BrandPreview({ name, brand, logo }: { name: string; brand: Record<string, unknown>; logo: string | null }) {
  const colors = strings(brand.colors);
  const fonts = strings(brand.fonts);
  const fontFamily = fonts.find(([k]) => k === "primary")?.[1];
  const typography = isObj(brand.typography) ? brand.typography : {};
  const palette = Object.fromEntries(colors);
  const samples = TYPE_STYLES.flatMap((style) => {
    const t = isObj(typography[style]) ? typography[style] : null;
    const size = num(t?.size);
    if (!t || size === null) return [];
    const letterSpacing = num(t.letterSpacing);
    return [
      <p
        key={style}
        className="break-words leading-tight"
        style={{ fontSize: size * SCALE, fontWeight: num(t.weight) ?? undefined, letterSpacing: letterSpacing === null ? undefined : letterSpacing * SCALE }}
      >
        {style} · contoh teks ({size * SCALE}px)
      </p>,
    ];
  });

  return (
    <div className="flex flex-col gap-4">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own range-aware route, next/image has nothing to optimize
        <img src={mediaUrl(logo)} alt={`Logo ${name}`} className="max-h-16 w-auto self-start" />
      )}

      {colors.length > 0 && (
        <ul aria-label="Warna" className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
          {colors.map(([key, value]) => (
            <li key={key} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-8 shrink-0 rounded-md border" style={{ backgroundColor: value }} />
              <span className="min-w-0 text-xs">
                <span className="block font-medium">{key}</span>
                <span className="block break-all font-mono text-muted-foreground">{value}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {fonts.length > 0 && (
        <ul aria-label="Font" className="flex flex-col gap-1 text-sm">
          {fonts.map(([key, value]) => (
            <li key={key}>
              <span className="font-medium">{key}:</span> <span className="break-words font-mono text-xs">{value}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The sample sits on the brand's own background and text color: its light text can be unreadable on this page's white. */}
      {samples.length > 0 && (
        <div className="flex flex-col gap-2 overflow-hidden rounded-md border p-3" style={{ backgroundColor: palette.bgLight, color: palette.textDark, fontFamily }}>
          {samples}
        </div>
      )}
    </div>
  );
}
