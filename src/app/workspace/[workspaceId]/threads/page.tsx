"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Hash,
  Image as ImageIcon,
  Loader,
  MessageSquareText,
  Mic,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
  ThreadSummary,
  useGetThreads,
} from "@/features/threads/api/use-get-threads";

/** Opens the thread in the right-hand panel on top of its channel or DM. */
const hrefFor = (thread: ThreadSummary, workspaceId: string) => {
  const base = thread.channelId
    ? `/workspace/${workspaceId}/channel/${thread.channelId}`
    : thread.dmMemberId
      ? `/workspace/${workspaceId}/member/${thread.dmMemberId}`
      : null;

  if (!base) return null;

  return `${base}?parentMessageId=${thread.rootMessageId}`;
};

const ThreadRow = ({
  thread,
  workspaceId,
}: {
  thread: ThreadSummary;
  workspaceId: string;
}) => {
  const href = hrefFor(thread, workspaceId);

  const body = (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-x-2 text-xs text-muted-foreground">
        {thread.channelName ? (
          <span className="inline-flex items-center font-medium text-slate-700">
            <Hash className="mr-0.5 size-3" />
            {thread.channelName}
          </span>
        ) : (
          <span className="font-medium text-slate-700">
            DM with {thread.dmName ?? "a teammate"}
          </span>
        )}
        <span>·</span>
        <span>
          {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
        </span>
        {thread.isMine && (
          <>
            <span>·</span>
            <span>you started this</span>
          </>
        )}
      </div>

      <div className="flex gap-x-3">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={thread.rootAuthorImage} />
          <AvatarFallback className="bg-sky-500 text-sm text-white">
            {thread.rootAuthorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{thread.rootAuthorName}</span>{" "}
            <span
              className="text-xs text-muted-foreground"
              title={format(new Date(thread.rootCreatedAt), "PPpp")}
            >
              {format(new Date(thread.rootCreatedAt), "MMM d, h:mm a")}
            </span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm">
            {thread.rootPreview || (
              <span className="inline-flex items-center gap-x-1 italic text-muted-foreground">
                {thread.rootHasAudio ? (
                  <>
                    <Mic className="size-3" /> Voice message
                  </>
                ) : thread.rootHasImage ? (
                  <>
                    <ImageIcon className="size-3" /> Image
                  </>
                ) : (
                  "No text"
                )}
              </span>
            )}
          </p>

          <div className="mt-2 flex items-center gap-x-2">
            <div className="flex -space-x-1.5">
              {thread.participants.map((participant) => (
                <Avatar
                  key={participant.memberId}
                  className="size-5 ring-2 ring-white"
                >
                  <AvatarImage src={participant.image} />
                  <AvatarFallback className="bg-sky-500 text-[9px] text-white">
                    {participant.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium">
                {thread.lastReplyAuthorName}
              </span>{" "}
              {thread.lastReplyPreview || "sent an attachment"} ·{" "}
              {formatDistanceToNow(new Date(thread.lastReplyAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!href) return <div>{body}</div>;

  return (
    <Link href={href} className="block transition-colors hover:bg-slate-50">
      {body}
    </Link>
  );
};

const ThreadsPage = () => {
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetThreads({ workspaceId });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Threads</h1>
          <p className="text-sm text-muted-foreground">
            Threads you started or replied in, most recent activity first.
          </p>
        </div>

        {!data?.length ? (
          <div className="flex flex-col items-center gap-y-2 rounded-lg border border-dashed p-10 text-center">
            <MessageSquareText className="size-6 text-muted-foreground" />
            <p className="font-medium">No threads yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Hover a message and hit reply to start a thread. Threads you take
              part in collect here.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {data.map((thread) => (
              <ThreadRow
                key={thread.rootMessageId}
                thread={thread}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreadsPage;
