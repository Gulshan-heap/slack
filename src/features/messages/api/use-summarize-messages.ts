import { useAction } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

type SummarizeArgs = {
  workspaceId: Id<"workspaces">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  parentMessageId?: Id<"messages">;
  limit?: number;
};

export const useSummarizeMessages = () => {
  const action = useAction(api.ai.summarize);
  const [isPending, setIsPending] = useState(false);

  const summarize = useCallback(
    async (args: SummarizeArgs) => {
      setIsPending(true);
      try {
        return await action(args);
      } finally {
        setIsPending(false);
      }
    },
    [action]
  );

  return { summarize, isPending };
};
