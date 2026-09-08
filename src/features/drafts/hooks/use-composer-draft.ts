import type { Op } from "quill/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { Id } from "../../../../convex/_generated/dataModel";
import { useGetDraft } from "../api/use-get-draft";
import { useSetDraft } from "../api/use-set-draft";

/** Keystrokes are cheap; mutations aren't. Save once the typing pauses. */
const SAVE_DEBOUNCE_MS = 700;

const parseOps = (body: string | undefined): Op[] => {
  if (!body) return [];

  try {
    const parsed = JSON.parse(body);

    return Array.isArray(parsed?.ops) ? (parsed.ops as Op[]) : [];
  } catch {
    return [];
  }
};

interface UseComposerDraftProps {
  workspaceId: Id<"workspaces">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
}

/**
 * Keeps an unsent composer body on the server, so half-typed messages survive
 * switching channels or reloading.
 *
 * `isReady` gates the editor: Quill seeds its contents once on mount, so
 * mounting it before the draft arrives would show an empty box and then
 * silently overwrite the saved draft on the next keystroke.
 */
export const useComposerDraft = ({
  workspaceId,
  channelId,
  conversationId,
}: UseComposerDraftProps) => {
  const { data, isLoading } = useGetDraft({
    workspaceId,
    channelId,
    conversationId,
  });

  const setDraft = useSetDraft();

  // null until the query resolves; an array afterwards, even if empty.
  const [seed, setSeed] = useState<Op[] | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const targetRef = useRef({ workspaceId, channelId, conversationId });

  targetRef.current = { workspaceId, channelId, conversationId };

  useEffect(() => {
    if (isLoading || seed !== null) return;

    setSeed(parseOps(data?.body));
  }, [isLoading, data?.body, seed]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const body = pendingRef.current;

    if (body === null) return;

    pendingRef.current = null;

    // Nothing the user can act on if this fails, and it retries on the next
    // keystroke anyway.
    void setDraft({ ...targetRef.current, body }).catch(() => {});
  }, [setDraft]);

  const onChange = useCallback(
    (body: string) => {
      pendingRef.current = body;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  /** Called after a successful send — drops the row and empties the seed. */
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    pendingRef.current = null;
    setSeed([]);

    void setDraft({ ...targetRef.current, body: "" }).catch(() => {});
  }, [setDraft]);

  // Switching channels unmounts the composer mid-debounce; save what's typed.
  useEffect(() => flush, [flush]);

  return {
    isReady: seed !== null,
    defaultValue: seed ?? [],
    onChange,
    clear,
  };
};
