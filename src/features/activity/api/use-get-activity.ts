import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export type ActivityItem = (typeof api.activity.list._returnType)[number];

export const useGetActivity = ({
  workspaceId,
}: {
  workspaceId: Id<"workspaces">;
}) => {
  const data = useQuery(api.activity.list, { workspaceId });

  return { data, isLoading: data === undefined };
};
