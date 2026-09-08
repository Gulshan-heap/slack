"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AtSign,
  Bell,
  Hash,
  Image as ImageIcon,
  Loader,
  MessageSquareText,
  Mic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
  ActivityItem,
  useGetActivity,
} from "@/features/activity/api/use-get-activity";
import { useMarkActivityRead } from "@/features/activity/api/use-mark-activity-read";

const VERBS: Record<ActivityItem["type"], string> = {
  mention: "mentioned you in",
  thread_reply: "replied to your thread in",
  reaction: "reacted to your message in",
};

/** Where the message lives, so the row can be clicked through to it. */
const hrefFor = (item: ActivityItem, workspaceId: string) => {
  const base = item.channelId
    ? `/workspace/${workspaceId}/channel/${item.channelId}`
    : item.dmMemberId
      ? `/workspace/${workspaceId}/member/${item.dmMemberId}`
      : null;

  if (!base) return null;

  // Thread replies and mentions inside a thread open the side panel directly.
  return item.parentMessageId
    ? `${base}?parentMessageId=${item.parentMessageId}`
    : base;
};

const ActivityRow = ({
  item,
  workspaceId,
  isNew,
}: {
  item: ActivityItem;
  workspaceId: string;
  isNew: boolean;
}) => {
  const href = hrefFor(item, workspaceId);

  const body = (
    <div className="flex gap-x-3 p-4">
      <div className="relative shrink-0">
        <Avatar className="size-9">
          <AvatarImage src={item.actorImage} />
          <AvatarFallback className="bg-sky-500 text-white text-sm">
            {item.actorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
          {item.type === "reaction" ? (
            <span className="text-[11px] leading-none">{item.value}</span>
          ) : item.type === "mention" ? (
            <AtSign className="size-3 text-sky-600" />
          ) : (
            <MessageSquareText className="size-3 text-emerald-600" />
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{item.actorName}</span>{" "}
          <span className="text-muted-foreground">{VERBS[item.type]}</span>{" "}
          <span className="font-medium">
            {item.channelName ? (
              <span className="inline-flex items-center">
                <Hash className="mr-0.5 inline size-3" />
                {item.channelName}
              </span>
            ) : (
              `your DM with ${item.dmName ?? "a teammate"}`
            )}
          </span>
        </p>

        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
          {item.preview || (
            <span className="inline-flex items-center gap-x-1 italic">
              {item.hasAudio ? (
                <>
                  <Mic className="size-3" /> Voice message
                </>
              ) : item.hasImage ? (
                <>
                  <ImageIcon className="size-3" /> Image
                </>
              ) : (
                "No text"
              )}
            </span>
          )}
        </p>

        <p
          className="mt-1 text-xs text-muted-foreground"
          title={format(new Date(item.createdAt), "PPpp")}
        >
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>

      {isNew && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
      )}
    </div>
  );

  if (!href) {
    return <div className={isNew ? "bg-sky-50/60" : undefined}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={`block transition-colors hover:bg-slate-50 ${
        isNew ? "bg-sky-50/60" : ""
      }`}
    >
      {body}
    </Link>
  );
};

const ActivityPage = () => {
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetActivity({ workspaceId });
  const markAllRead = useMarkActivityRead();

  // Rows that were unread when the page opened stay highlighted even after we
  // mark them read, so opening Activity doesn't blank out what's new.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const marked = useRef(false);

  useEffect(() => {
    if (!data || marked.current) return;

    marked.current = true;
    setNewIds(new Set(data.filter((i) => !i.readAt).map((i) => i._id)));

    void markAllRead({ workspaceId }).catch(() => {});
  }, [data, markAllRead, workspaceId]);

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
        <div className="mb-4 flex items-start justify-between gap-x-4">
          <div>
            <h1 className="text-2xl font-bold">Activity</h1>
            <p className="text-sm text-muted-foreground">
              Mentions, thread replies, and reactions on your messages.
            </p>
          </div>
          {!!data?.length && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void markAllRead({ workspaceId })}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {!data?.length ? (
          <div className="flex flex-col items-center gap-y-2 rounded-lg border border-dashed p-10 text-center">
            <Bell className="size-6 text-muted-foreground" />
            <p className="font-medium">Nothing yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              When someone @-mentions you, replies in a thread you started, or
              reacts to one of your messages, it shows up here.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {data.map((item) => (
              <ActivityRow
                key={item._id}
                item={item}
                workspaceId={workspaceId}
                isNew={newIds.has(item._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
