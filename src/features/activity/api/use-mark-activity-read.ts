import { useMutation } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export const useMarkActivityRead = () => {
  return useMutation(api.activity.markAllRead);
};
