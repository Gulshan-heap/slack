import { useMutation } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export const useSetDraft = () => {
  return useMutation(api.drafts.set);
};
