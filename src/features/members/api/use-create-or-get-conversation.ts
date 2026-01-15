import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export const useCreateOrGetConversation = () => {
  return useMutation(api.conversations.createOrGet);
};
