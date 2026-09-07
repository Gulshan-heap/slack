import { useAction } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export const useGenerateWellnessInsight = () => {
  const action = useAction(api.wellness.generateWellnessInsight);
  const [isPending, setIsPending] = useState(false);

  const generate = useCallback(
    async (args: { workspaceId: Id<"workspaces">; scope: "team" | "mine" }) => {
      setIsPending(true);
      try {
        return await action(args);
      } finally {
        setIsPending(false);
      }
    },
    [action]
  );

  return { generate, isPending };
};
