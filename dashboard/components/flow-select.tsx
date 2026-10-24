import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/flow-editor/field";

export type FlowOption = { id: string; name: string; valid: boolean };

// The flow picker of the create-video form and of "Pakai di alur": a flow that cannot be used is shown but disabled.
export function FlowSelect({ flows, ...props }: Omit<ComponentProps<typeof NativeSelect>, "options"> & { flows: FlowOption[] }) {
  return <NativeSelect {...props} options={flows.map((f) => ({ value: f.id, label: f.valid ? f.name : `${f.name} (tidak valid)`, disabled: !f.valid }))} />;
}
