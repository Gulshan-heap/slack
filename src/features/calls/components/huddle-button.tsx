"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Loader, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useJoinCall } from "../api/use-join-call";
import { useGetActiveCall } from "../api/use-get-active-call";
import { useActiveCall } from "../store/use-active-call";

import { Id } from "../../../../convex/_generated/dataModel";

const MAX_SHOWN_AVATARS = 3;

interface HuddleButtonProps {
  /** Shown in the dock header, e.g. "# general" or a member's name. */
  title: string;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
}

export const HuddleButton = ({
  title,
  channelId,
  conversationId,
}: HuddleButtonProps) => {
  const workspaceId = useWorkspaceId();

  const [activeCall, setActiveCall] = useActiveCall();
  const { data: call } = useGetActiveCall({ workspaceId, channelId, conversationId });
  const joinCall = useJoinCall();

  const [isPending, setIsPending] = useState(false);

  const isInThisCall = !!call && activeCall?.callId === call._id;
  const participants = call?.participants ?? [];

  const handleClick = async () => {
    if (isInThisCall) return;

    if (activeCall) {
      toast.info("Leave your current huddle first");
      return;
    }

    try {
      setIsPending(true);

      const { callId } = await joinCall({ workspaceId, channelId, conversationId });

      setActiveCall({ callId, workspaceId, title });
    } catch {
      toast.error("Failed to start the huddle");
    } finally {
      setIsPending(false);
    }
  };

  if (!call) {
    return (
      <Hint label="Start a huddle">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={handleClick}
          disabled={isPending}
        >
          {isPending ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <Video className="size-4" />
          )}
        </Button>
      </Hint>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isPending || isInThisCall}
      className={cn(
        "h-7 gap-x-2 rounded-full border px-2",
        isInThisCall
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 disabled:opacity-100"
          : "border-emerald-500/40 text-emerald-600 hover:text-emerald-600"
      )}
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
      <span className="text-xs font-semibold">
        {isInThisCall ? "In huddle" : "Join huddle"}
      </span>
      <span className="flex -space-x-1.5">
        {participants.slice(0, MAX_SHOWN_AVATARS).map((participant) => (
          <Avatar
            key={participant.memberId}
            className="size-5 border border-background"
          >
            <AvatarImage className="object-cover" src={participant.image} />
            <AvatarFallback className="text-[9px]">
              {participant.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      {participants.length > MAX_SHOWN_AVATARS && (
        <span className="text-xs">
          +{participants.length - MAX_SHOWN_AVATARS}
        </span>
      )}
    </Button>
  );
};
