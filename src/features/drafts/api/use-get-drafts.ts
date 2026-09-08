import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export type DraftItem = (typeof api.drafts.list._returnType)[number];

export const useGetDrafts = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const data = useQuery(api.drafts.list, { workspaceId });

  return { data, isLoading: data === undefined };
};
