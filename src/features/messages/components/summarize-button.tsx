"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Loader, Sparkles } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useSummarizeMessages } from "../api/use-summarize-messages";

import { Id } from "../../../../convex/_generated/dataModel";

interface SummarizeButtonProps {
  /** What is being summarized, e.g. "# general" or a member's name. */
  title: string;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  parentMessageId?: Id<"messages">;
}

/** Splits the model's plain-text bullet list back into individual points. */
const toBullets = (summary: string) =>
  summary
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

export const SummarizeButton = ({
  title,
  channelId,
  conversationId,
  parentMessageId,
}: SummarizeButtonProps) => {
  const workspaceId = useWorkspaceId();
  const { summarize, isPending } = useSummarizeMessages();

  const [open, setOpen] = useState(false);
  const [bullets, setBullets] = useState<string[]>([]);
  const [messageCount, setMessageCount] = useState(0);

  const handleClick = async () => {
    try {
      const result = await summarize({
        workspaceId,
        channelId,
        conversationId,
        parentMessageId,
      });

      if (!result || result.messageCount === 0) {
        toast.info("There are no messages to summarize yet");
        return;
      }

      if (!result.summary) {
        toast.info("Not enough messages to summarize yet");
        return;
      }

      setBullets(toBullets(result.summary));
      setMessageCount(result.messageCount);
      setOpen(true);
    } catch {
      toast.error("Failed to summarize the conversation");
    }
  };

  return (
    <>
      <Hint label="Summarize with AI">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleClick}
          disabled={isPending}
        >
          {isPending ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </Button>
      </Hint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" />
              Summary of {title}
            </DialogTitle>
            <DialogDescription>
              The last {messageCount} messages, condensed by AI.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5">
            {bullets.map((bullet, index) => (
              <li key={index} className="flex gap-2.5 text-sm">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};
