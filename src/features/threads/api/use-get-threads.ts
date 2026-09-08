import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export type ThreadSummary = (typeof api.threads.list._returnType)[number];

export const useGetThreads = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const data = useQuery(api.threads.list, { workspaceId });

  return { data, isLoading: data === undefined };
};
