import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export const useActivityUnreadCount = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const data = useQuery(
    api.activity.unreadCount,
    workspaceId ? { workspaceId } : "skip"
  );

  return { count: data ?? 0, isLoading: data === undefined };
};
