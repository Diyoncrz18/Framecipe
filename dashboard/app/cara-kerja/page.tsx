import fs from "node:fs";
import path from "node:path";
import { Markdown } from "@/components/markdown";
import { PipelineDiagram } from "@/components/pipeline-diagram";

// The page text lives in dashboard/content so it can be edited without touching code. The server runs from dashboard/ (npm run dev/start).
const SOURCE = path.join(/*turbopackIgnore: true*/ process.cwd(), "content", "cara-kerja.md");

export default function Page() {
  let source: string;
  try {
    source = fs.readFileSync(/*turbopackIgnore: true*/ SOURCE, "utf8");
  } catch {
    source = "Isi halaman ini tidak ditemukan (`dashboard/content/cara-kerja.md`).";
  }
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Cara Kerja</h1>
      <PipelineDiagram />
      <Markdown source={source} />
    </div>
  );
}
