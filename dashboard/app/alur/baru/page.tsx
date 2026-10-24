import Link from "next/link";
import { FlowForm, type InitialFlow } from "@/components/flow-editor/flow-form";
import { defaultFlow } from "@/core/flow-form.mjs";
import { loadEditorData } from "../editor-data";

export default function Page() {
  const data = loadEditorData();
  // The catalog item carries what templateInfo found: aspectRatio, width and height.
  const template = data.templates.find((t) => t.engine === "remotion");
  const brand = data.brands.find((b) => b.id === "default") ?? data.brands[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/alur" className="text-sm underline underline-offset-2">Kembali ke daftar alur</Link>
        <h1 className="text-2xl font-semibold">Buat alur</h1>
      </div>
      {template ? (
        <FlowForm mode="create" initial={defaultFlow(template.id, brand?.id ?? "", template) as InitialFlow} data={data} />
      ) : (
        <p role="alert" className="text-destructive">Belum ada template Remotion di folder templates/, jadi alur belum bisa dibuat.</p>
      )}
    </div>
  );
}
