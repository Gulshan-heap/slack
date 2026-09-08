import Quill from "quill";

/**
 * Class prefix used by the inline `mention` format. A mention op looks like
 * `{ insert: "@Ada", attributes: { mention: "member" } }` and renders as
 * `<span class="ql-mention-member">@Ada</span>`.
 */
export const MENTION_CLASS_PREFIX = "ql-mention";

/** The literal token that triggers an AI reply, matched case-insensitively. */
export const AI_MENTION = "@ai";

let registered = false;

/**
 * Registers the inline `mention` format on the global Quill registry so
 * mention chips survive the delta round trip (editor -> Convex -> renderer).
 * Safe to call repeatedly; if registration fails mentions stay plain text.
 */
export const registerMentionFormat = () => {
  if (registered) return;
  registered = true;

  try {
    const Parchment = Quill.import("parchment");
    const MentionAttributor = new Parchment.ClassAttributor(
      "mention",
      MENTION_CLASS_PREFIX,
      { scope: Parchment.Scope.INLINE },
    );

    Quill.register(MentionAttributor, true);
  } catch (error) {
    console.warn("Failed to register the Quill mention format", error);
  }
};
