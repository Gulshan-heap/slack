import { useEffect } from "react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

const HEARTBEAT_INTERVAL_MS = 20000;

export const usePresenceHeartbeat = (workspaceId: Id<"workspaces">) => {
  const heartbeat = useMutation(api.wellness.heartbeat);

  useEffect(() => {
    if (!workspaceId) return;

    heartbeat({ workspaceId });
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        heartbeat({ workspaceId });
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [workspaceId, heartbeat]);
};
