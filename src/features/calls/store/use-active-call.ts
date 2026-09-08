import { atom, useAtom } from "jotai";

import { Id } from "../../../../convex/_generated/dataModel";

export type ActiveCall = {
  callId: Id<"calls">;
  workspaceId: Id<"workspaces">;
  /** Shown in the dock header, e.g. "# general" or a member's name. */
  title: string;
};

const activeCallState = atom<ActiveCall | null>(null);

/**
 * The call this tab is currently connected to. Held outside the route tree so
 * the dock survives navigating between channels.
 */
export const useActiveCall = () => {
  return useAtom(activeCallState);
};
