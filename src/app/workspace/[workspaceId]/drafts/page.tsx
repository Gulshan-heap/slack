"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Hash, Loader, SendHorizontal, Trash2 } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { DraftItem, useGetDrafts } from "@/features/drafts/api/use-get-drafts";
import { useRemoveDraft } from "@/features/drafts/api/use-remove-draft";

const hrefFor = (draft: DraftItem, workspaceId: string) => {
  if (draft.channelId) {
    return `/workspace/${workspaceId}/channel/${draft.channelId}`;
  }

  if (draft.dmMemberId) {
    return `/workspace/${workspaceId}/member/${draft.dmMemberId}`;
  }

  return null;
};

const DraftsPage = () => {
  const workspaceId = useWorkspaceId();
  const { data, isLoading } = useGetDrafts({ workspaceId });
  const removeDraft = useRemoveDraft();

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
          <h1 className="text-2xl font-bold">Drafts</h1>
          <p className="text-sm text-muted-foreground">
            Messages you started but never sent. Open one to pick up where you
            left off — the text is waiting in the composer.
          </p>
        </div>

        {!data?.length ? (
          <div className="flex flex-col items-center gap-y-2 rounded-lg border border-dashed p-10 text-center">
            <SendHorizontal className="size-6 text-muted-foreground" />
            <p className="font-medium">No drafts</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Anything you type and leave unsent is saved here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {data.map((draft) => {
              const href = hrefFor(draft, workspaceId);

              return (
                <div
                  key={draft._id}
                  className="flex items-start gap-x-3 p-4 transition-colors hover:bg-slate-50"
                >
                  {draft.channelName ? (
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <Hash className="size-4 text-slate-600" />
                    </span>
                  ) : (
                    <Avatar className="mt-0.5 size-9 shrink-0">
                      <AvatarImage src={draft.dmImage} />
                      <AvatarFallback className="bg-sky-500 text-sm text-white">
                        {(draft.dmName ?? "M").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {draft.channelName ? (
                        <span className="inline-flex items-center">
                          <Hash className="mr-0.5 size-3" />
                          {draft.channelName}
                        </span>
                      ) : (
                        (draft.dmName ?? "Member")
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {draft.preview}
                    </p>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      title={format(new Date(draft.updatedAt), "PPpp")}
                    >
                      Edited{" "}
                      {formatDistanceToNow(new Date(draft.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-x-1">
                    {href && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={href}>Resume</Link>
                      </Button>
                    )}
                    <Hint label="Discard draft" side="top">
                      <Button
                        size="iconSm"
                        variant="ghost"
                        onClick={() =>
                          void removeDraft({ id: draft._id }).catch(() => {})
                        }
                      >
                        <Trash2 className="size-4 text-rose-600" />
                      </Button>
                    </Hint>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftsPage;
