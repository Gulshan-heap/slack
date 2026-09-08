import { useMutation } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export const useRemoveDraft = () => {
  return useMutation(api.drafts.remove);
};
