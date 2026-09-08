import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface UseGetActiveCallProps {
  workspaceId: Id<"workspaces">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
};

export const useGetActiveCall = ({
  workspaceId,
  channelId,
  conversationId,
}: UseGetActiveCallProps) => {
  const data = useQuery(
    api.calls.getActive,
    workspaceId && (channelId || conversationId)
      ? { workspaceId, channelId, conversationId }
      : "skip",
  );

  return { data, isLoading: data === undefined };
};
