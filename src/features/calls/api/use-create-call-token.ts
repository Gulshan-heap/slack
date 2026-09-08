import { useAction } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export const useCreateCallToken = () => {
  return useAction(api.livekit.createToken);
};
