import { useMutation } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export const useLeaveCall = () => {
  return useMutation(api.calls.leave);
};
