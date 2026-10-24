"use client";

import { useTransition } from "react";
import { archiveFlowAction } from "@/app/alur/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Archive moves the folder to flows/.archive/ and deletes nothing (NFR-11), but it still asks first.
export function ArchiveButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" aria-label={`Arsipkan alur ${name}`} />}>Arsipkan</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Arsipkan alur {name}?</DialogTitle>
          <DialogDescription>File dipindah ke flows/.archive/ dan tidak dihapus.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <Button disabled={pending} onClick={() => start(() => archiveFlowAction(id))}>Arsipkan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
