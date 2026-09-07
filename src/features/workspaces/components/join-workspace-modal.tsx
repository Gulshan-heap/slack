"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import VerificationInput from "react-verification-input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { useJoinWorkspaceModal } from "../store/use-join-workspace-modal";
import { useJoinByCode } from "../api/use-join-by-code";

export const JoinWorkspaceModal = () => {
  const router = useRouter();
  const [open, setOpen] = useJoinWorkspaceModal();
  const { mutate, isPending } = useJoinByCode();

  const [key, setKey] = useState(0);

  const handleClose = () => {
    setOpen(false);
    setKey((prev) => prev + 1);
  };

  const handleComplete = (value: string) => {
    mutate(
      { joinCode: value },
      {
        onSuccess: (id) => {
          toast.success("Workspace joined");
          router.push(`/workspace/${id}`);
          handleClose();
        },
        onError: () => {
          toast.error("Invalid join code");
          setKey((prev) => prev + 1);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a workspace</DialogTitle>
          <DialogDescription>
            Enter the workspace&apos;s invite code to join it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <VerificationInput
            key={key}
            onComplete={handleComplete}
            length={6}
            classNames={{
              container: cn("flex gap-x-2", isPending && "opacity-50 cursor-not-allowed"),
              character: "uppercase h-auto rounded-md border border-input flex items-center justify-center text-lg font-medium text-muted-foreground",
              characterInactive: "bg-muted",
              characterSelected: "bg-background text-foreground",
              characterFilled: "bg-background text-foreground",
            }}
            autoFocus
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
