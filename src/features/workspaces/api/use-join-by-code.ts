import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

type RequestType = { joinCode: string };
type ResponseType = Id<"workspaces"> | null;

type Options = {
  onSuccess?: (data: ResponseType) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
  throwError?: boolean;
};

export const useJoinByCode = () => {
  const [isPending, setIsPending] = useState(false);
  const mutation = useMutation(api.workspaces.joinByCode);

  const mutate = useCallback(
    async (values: RequestType, options?: Options) => {
      setIsPending(true);
      try {
        const response = await mutation(values);
        options?.onSuccess?.(response);
        return response;
      } catch (error) {
        options?.onError?.(error as Error);
        if (options?.throwError) throw error;
        return null;
      } finally {
        setIsPending(false);
        options?.onSettled?.();
      }
    },
    [mutation]
  );

  return { mutate, isPending };
};
