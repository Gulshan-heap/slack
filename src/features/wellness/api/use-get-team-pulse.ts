import { useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export const useGetTeamPulse = ({
  workspaceId,
  days,
  enabled = true,
}: {
  workspaceId: Id<"workspaces">;
  days?: number;
  enabled?: boolean;
}) => {
  const data = useQuery(
    api.wellness.getTeamPulse,
    enabled ? { workspaceId, days } : "skip"
  );
  const isLoading = enabled && data === undefined;
  return { data, isLoading };
};
