import Image from "next/image";
import { useQuery } from "convex/react";
import { Delta, Op } from "quill/core";
import { MdSend } from "react-icons/md";
import { PiTextAa } from "react-icons/pi";
import Quill, { type QuillOptions } from "quill";
import { ImageIcon, Smile, Sparkles, XIcon } from "lucide-react";
import { MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { registerMentionFormat } from "@/lib/quill-mention";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { Hint } from "./hint";
import { Button } from "./ui/button";
import { EmojiPopover } from "./emoji-popover";
import { VoiceRecorderButton } from "./voice-recorder-button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

import { api } from "../../convex/_generated/api";

import "quill/dist/quill.snow.css";

registerMentionFormat();

type EditorValue = {
  image: File | null;
  body: string;
};

type MentionOption = {
  /** Inserted after the "@", so this is what @ai detection matches on. */
  label: string;
  title: string;
  kind: "member" | "ai";
  image?: string;
};

const MAX_MENTION_RESULTS = 6;

/**
 * Reads the mention query the caret currently sits in, or null when the caret
 * is not inside one. The "@" must start the line or follow whitespace so email
 * addresses do not open the picker.
 */
const readMentionQuery = (quill: Quill) => {
  const range = quill.getSelection();

  if (!range || range.length > 0) return null;

  const before = quill.getText(0, range.index);
  const match = /(?:^|\s)@([\w.-]*)$/.exec(before);

  if (!match) return null;

  return {
    start: range.index - match[1].length - 1,
    query: match[1].toLowerCase(),
  };
};

interface EditorProps {
  onSubmit: ({ image, body }: EditorValue) => void;
  onCancel?: () => void;
  onRecordVoice?: (blob: Blob, durationMs: number) => void;
  placeholder?: string;
  defaultValue?: Delta | Op[];
  disabled?: boolean;
  innerRef?: MutableRefObject<Quill | null>;
  variant?: "create" | "update";
};

const Editor = ({
  onCancel,
  onSubmit,
  onRecordVoice,
  placeholder = "Write something...",
  defaultValue = [],
  disabled = false,
  innerRef,
  variant = "create"
}: EditorProps) => {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const submitRef = useRef(onSubmit);
  const placeholderRef = useRef(placeholder);
  const quillRef = useRef<Quill | null>(null);
  const defaultValueRef = useRef(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);
  const disabledRef = useRef(disabled);
  const imageElementRef = useRef<HTMLInputElement>(null);

  const workspaceId = useWorkspaceId();
  const members = useQuery(
    api.members.get,
    workspaceId ? { workspaceId } : "skip",
  );

  const mentionOptions = useMemo<MentionOption[]>(() => {
    const memberOptions = (members ?? [])
      .filter((member) => !member.user.isBot)
      .map((member) => ({
        label: (member.user.name ?? "Member").replace(/\s+/g, ""),
        title: member.user.name ?? "Member",
        kind: "member" as const,
        image: member.user.image,
      }));

    return [
      { label: "ai", title: "AI assistant", kind: "ai" as const },
      ...memberOptions,
    ];
  }, [members]);

  const mentionResults = useMemo(() => {
    if (!mention) return [];

    return mentionOptions
      .filter(({ label, title }) =>
        label.toLowerCase().startsWith(mention.query) ||
        title.toLowerCase().includes(mention.query)
      )
      .slice(0, MAX_MENTION_RESULTS);
  }, [mention, mentionOptions]);

  // The keyboard bindings below are registered once on mount, so they read the
  // live picker state through refs instead of closing over stale state.
  const mentionResultsRef = useRef(mentionResults);
  const activeMentionIndexRef = useRef(activeMentionIndex);
  const applyMentionRef = useRef<(option: MentionOption) => void>(() => {});
  const setActiveMentionIndexRef = useRef(setActiveMentionIndex);
  const closeMentionRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    submitRef.current = onSubmit;
    placeholderRef.current = placeholder;
    defaultValueRef.current = defaultValue;
    disabledRef.current = disabled;
    mentionResultsRef.current = mentionResults;
    activeMentionIndexRef.current = activeMentionIndex;
    setActiveMentionIndexRef.current = setActiveMentionIndex;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const editorContainer = container.appendChild(
      container.ownerDocument.createElement("div"),
    );

    const isMentionOpen = () => mentionResultsRef.current.length > 0;

    const options: QuillOptions = {
      theme: "snow",
      placeholder: placeholderRef.current,
      modules: {
        toolbar: [
          ["bold", "italic", "underline", "strike"],
          ["link", "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["clean"],
        ],
        keyboard: {
          bindings: {
            enter: {
              key: "Enter",
              handler: () => {
                if (isMentionOpen()) {
                  const option =
                    mentionResultsRef.current[activeMentionIndexRef.current];

                  if (option) applyMentionRef.current(option);
                  return;
                }

                const text = quill.getText();
                const addedImage = imageElementRef.current?.files?.[0] || null;

                const isEmpty = !addedImage && text.replace(/<(.|\n)*?>/g, "").trim().length === 0;

                if (isEmpty) return;

                const body = JSON.stringify(quill.getContents());
                submitRef.current?.({ body, image: addedImage });
              }
            },
            shift_enter: {
              key: "Enter",
              shiftKey: true,
              handler: () => {
                quill.insertText(quill.getSelection()?.index || 0, "\n");
              },
            },
            mention_tab: {
              key: "Tab",
              handler: () => {
                if (!isMentionOpen()) return true;

                const option =
                  mentionResultsRef.current[activeMentionIndexRef.current];

                if (option) applyMentionRef.current(option);
                return false;
              },
            },
            mention_down: {
              key: "ArrowDown",
              handler: () => {
                if (!isMentionOpen()) return true;

                setActiveMentionIndexRef.current((current) =>
                  (current + 1) % mentionResultsRef.current.length
                );
                return false;
              },
            },
            mention_up: {
              key: "ArrowUp",
              handler: () => {
                if (!isMentionOpen()) return true;

                setActiveMentionIndexRef.current((current) =>
                  (current - 1 + mentionResultsRef.current.length) %
                  mentionResultsRef.current.length
                );
                return false;
              },
            },
            mention_escape: {
              key: "Escape",
              handler: () => {
                if (!isMentionOpen()) return true;

                closeMentionRef.current();
                return false;
              },
            },
          }
        },
      },
    };

    const quill = new Quill(editorContainer, options);
    quillRef.current = quill;
    quillRef.current.focus();

    if (innerRef) {
      innerRef.current = quill;
    }

    quill.setContents(defaultValueRef.current);
    setText(quill.getText());

    const syncMention = () => {
      setMention(readMentionQuery(quill));
      setActiveMentionIndex(0);
    };

    quill.on(Quill.events.TEXT_CHANGE, () => {
      setText(quill.getText());
      syncMention();
    });

    quill.on(Quill.events.SELECTION_CHANGE, syncMention);

    return () => {
      quill.off(Quill.events.TEXT_CHANGE);
      quill.off(Quill.events.SELECTION_CHANGE);
      if (container) {
        container.innerHTML = "";
      }
      if (quillRef.current) {
        quillRef.current = null;
      }
      if (innerRef) {
        innerRef.current = null;
      }
    };
  }, [innerRef]);

  const closeMention = () => {
    setMention(null);
    setActiveMentionIndex(0);
  };

  closeMentionRef.current = closeMention;

  /** Swaps the typed mention query for a formatted mention chip plus a space. */
  const applyMention = (option: MentionOption) => {
    const quill = quillRef.current;

    if (!quill || !mention) return;

    const range = quill.getSelection(true);
    const cursor = range ? range.index : quill.getLength();
    const token = `@${option.label}`;

    quill.deleteText(mention.start, cursor - mention.start, "user");
    quill.insertText(mention.start, token, { mention: option.kind }, "user");
    quill.insertText(mention.start + token.length, " ", { mention: false }, "user");
    quill.setSelection(mention.start + token.length + 1, 0, "user");

    closeMention();
  };

  applyMentionRef.current = applyMention;

  const toggleToolbar = () => {
    setIsToolbarVisible((current) => !current);
    const toolbarElement = containerRef.current?.querySelector(".ql-toolbar");

    if (toolbarElement) {
      toolbarElement.classList.toggle("hidden");
    }
  };

  const onEmojiSelect = (emojiValue: string) => {
    const quill = quillRef.current;
    if (!quill) return;

    // Ensure editor regains focus
    quill.focus();

    // Get current selection or fallback to end of text
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();

    quill.insertText(index, emojiValue);
    quill.setSelection(index + emojiValue.length, 0);
  };

  const isEmpty = !image && text.replace(/<(.|\n)*?>/g, "").trim().length === 0;

  return (
    <div className="flex flex-col">
      <input
        type="file"
        accept="image/*"
        ref={imageElementRef}
        onChange={(event) => setImage(event.target.files![0])}
        className="hidden"
      />
      <div className={cn(
        "relative flex flex-col border border-border rounded-md focus-within:shadow-sm transition bg-background",
        disabled && "opacity-50"
      )}>
        {mentionResults.length > 0 && (
          <div className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-sm overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mention
            </p>
            {mentionResults.map((option, index) => (
              <button
                key={`${option.kind}-${option.label}`}
                type="button"
                // Keep the caret in the editor so the mention lands in place.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveMentionIndex(index)}
                onClick={() => applyMention(option)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                  index === activeMentionIndex && "bg-accent"
                )}
              >
                {option.kind === "ai" ? (
                  <span className="flex size-6 items-center justify-center rounded bg-violet-500/15 text-violet-500">
                    <Sparkles className="size-3.5" />
                  </span>
                ) : (
                  <Avatar className="size-6 rounded">
                    <AvatarImage src={option.image} />
                    <AvatarFallback className="rounded text-xs">
                      {option.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="truncate font-medium">{option.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  @{option.label}
                </span>
              </button>
            ))}
          </div>
        )}
        <div ref={containerRef} className="h-full ql-custom" />
        {!!image && (
          <div className="p-2">
            <div className="relative size-[62px] flex items-center justify-center group/image">
              <Hint label="Remove image">
                <button
                  onClick={() => {
                    setImage(null);
                    imageElementRef.current!.value = "";
                  }}
                  className="hidden group-hover/image:flex rounded-full bg-black/70 hover:bg-black absolute -top-2.5 -right-2.5 text-white size-6 z-[4] border-2 border-white items-center justify-center"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Hint>
              <Image
                src={URL.createObjectURL(image)}
                alt="Uploaded"
                fill
                className="rounded-xl overflow-hidden border object-cover"
              />
            </div>
          </div>
        )}
        <div className="flex px-2 pb-2 z-[5]">
          <Hint label={isToolbarVisible ? "Hide formatting" : "Show formatting"}>
            <Button
              disabled={disabled}
              size="iconSm"
              variant="ghost"
              onClick={toggleToolbar}
            >
              <PiTextAa className="size-4" />
            </Button>
          </Hint>
          <EmojiPopover onEmojiSelect={onEmojiSelect}>
            <Button
              disabled={disabled}
              size="iconSm"
              variant="ghost"
            >
              <Smile className="size-4" />
            </Button>
          </EmojiPopover>
          {variant === "create" && (
            <Hint label="Image">
              <Button
                disabled={disabled}
                size="iconSm"
                variant="ghost"
                onClick={() => imageElementRef.current?.click()}
              >
                <ImageIcon className="size-4" />
              </Button>
            </Hint>
          )}
          {variant === "create" && onRecordVoice && (
            <VoiceRecorderButton onRecorded={onRecordVoice} disabled={disabled} />
          )}
          {variant === "update" && (
            <div className="ml-auto flex items-center gap-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={disabled}
              >
                Cancel
              </Button>
              <Button
                disabled={disabled || isEmpty}
                onClick={() => {
                  onSubmit({
                    body: JSON.stringify(quillRef.current?.getContents()),
                    image,
                  });
                }}
                size="sm"
                className="bg-[#007a5a] hover:bg-[#007a5a]/80 text-white"
              >
                Save
              </Button>
            </div>
          )}
          {variant === "create" && (
            <Button
              disabled={disabled || isEmpty}
              onClick={() => {
                onSubmit({
                  body: JSON.stringify(quillRef.current?.getContents()),
                  image,
                });
              }}
              size="iconSm"
              className={cn(
                "ml-auto",
                isEmpty
                  ? "bg-background hover:bg-background text-muted-foreground"
                  : "bg-[#007a5a] hover:bg-[#007a5a]/80 text-white"
              )}
            >
              <MdSend className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {variant === "create" && (
        <div className={cn(
          "p-2 text-[10px] text-muted-foreground flex justify-end opacity-0 transition",
          !isEmpty && "opacity-100"
        )}>
          <p>
            <strong>Shift + Return</strong> to add a new line &middot;{" "}
            <strong>@</strong> to mention someone, <strong>@ai</strong> to ask the AI
          </p>
        </div>
      )}
    </div>
  );
};

export default Editor;
