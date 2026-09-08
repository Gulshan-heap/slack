import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

/**
 * The saved composer body for one channel/DM. `isLoading` matters here: the
 * editor seeds its contents once on mount, so callers must wait for this
 * before rendering it or the draft is lost.
 */
export const useGetDraft = ({
  workspaceId,
  channelId,
  conversationId,
}: {
  workspaceId: Id<"workspaces">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
}) => {
  const data = useQuery(api.drafts.get, {
    workspaceId,
    channelId,
    conversationId,
  });

  return { data, isLoading: data === undefined };
};
