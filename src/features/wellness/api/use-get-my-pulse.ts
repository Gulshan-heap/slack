import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export const useGetMyPulse = ({
  workspaceId,
  days,
}: {
  workspaceId: Id<"workspaces">;
  days?: number;
}) => {
  const data = useQuery(api.wellness.getMyPulse, { workspaceId, days });
  const isLoading = data === undefined;
  return { data, isLoading };
};
