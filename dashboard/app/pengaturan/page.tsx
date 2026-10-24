import path from "node:path";
import { CoreChecks, Mark } from "@/components/health-checks";
import { checkHealth } from "@/core/health.mjs";
import { ROOT } from "@/lib/root";

const LOCATIONS = [
  { label: "Root repo", dir: ROOT },
  { label: "Alur", dir: path.join(ROOT, "flows") },
  { label: "Proyek", dir: path.join(ROOT, "projects") },
  { label: "Data dashboard", dir: path.join(ROOT, ".dashboard") },
];

export default function Page() {
  const health = checkHealth(ROOT);
  const keysFilled = health.env.filter((k) => k.present).length;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Pengaturan</h1>

      <section className="flex flex-col gap-3" aria-labelledby="lokasi">
        <h2 id="lokasi" className="text-lg font-semibold">Lokasi</h2>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {LOCATIONS.map(({ label, dir }) => (
            <div key={label} className="contents">
              <dt className="font-medium">{label}</dt>
              <dd><code className="break-all text-sm">{dir}</code></dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="kesehatan">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 id="kesehatan" className="text-lg font-semibold">Kesehatan</h2>
          {/* A plain link on purpose: a full reload runs the checks again. */}
          <a href="/pengaturan" className="text-sm underline underline-offset-2">Periksa ulang</a>
        </div>
        <ul className="flex flex-col gap-1.5">
          <CoreChecks health={health} />
          <li>
            <Mark ok={!health.isWorktree}>
              {health.isWorktree ? "Ini worktree: run.mjs menolak berjalan di sini. Buka folder repo utama." : "Folder repo utama (bukan worktree)"}
            </Mark>
          </li>
          <li>
            <Mark ok={health.sharedBrowser} warn>
              {health.sharedBrowser ? "Browser render bersama tersedia" : "Browser render bersama belum ada. Chrome diunduh saat render pertama, lalu disalin ke .dashboard/browser"}
            </Mark>
          </li>
        </ul>

        <h3 className="mt-2 font-semibold">API key</h3>
        <p className="text-sm text-muted-foreground">
          Dibaca dari <code>.env</code>. Hanya status terisi atau kosong yang ditampilkan, nilainya tidak pernah dikirim ke browser. Terisi: {keysFilled} dari {health.env.length}.
        </p>
        {health.env.length === 0 ? (
          <p className="text-sm">Tidak ada API key terdaftar.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {health.env.map(({ key, present }) => (
              <li key={key}>
                <Mark ok={present} warn>
                  <code className="text-sm">{key}</code> {present ? "terisi" : "kosong"}
                </Mark>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">Halaman langsung diperbarui otomatis setiap 2 detik.</p>
    </div>
  );
}
