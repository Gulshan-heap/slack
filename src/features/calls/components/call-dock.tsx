"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader, Maximize2, Minimize2, PhoneOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";

import { useLeaveCall } from "../api/use-leave-call";
import { useCreateCallToken } from "../api/use-create-call-token";
import { useActiveCall } from "../store/use-active-call";

const CallRoom = dynamic(() => import("./call-room"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-black">
      <Loader className="size-5 animate-spin text-white/70" />
    </div>
  ),
});

/**
 * A `ConvexError` arrives with its payload on `data`; plain server errors are
 * redacted in production, so fall back to a caller-supplied message.
 */
const readErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { data?: unknown })?.data;

  if (typeof data === "string" && data) return data;

  const message = (error as { message?: unknown })?.message;

  if (typeof message === "string" && message) return message;

  return fallback;
};

/**
 * Floating huddle window. Rendered once by the workspace layout so a call
 * keeps running while you read other channels.
 */
export const CallDock = () => {
  const [activeCall, setActiveCall] = useActiveCall();
  const [credentials, setCredentials] = useState<{ url: string; token: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const createToken = useCreateCallToken();
  const leaveCall = useLeaveCall();

  // `leave` runs from event handlers and cleanups, so keep the ids in a ref.
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  const handleLeave = useCallback(() => {
    const call = activeCallRef.current;

    setActiveCall(null);
    setCredentials(null);
    setIsExpanded(false);

    if (call) {
      leaveCall({ callId: call.callId }).catch(() => {
        // Losing the leave record only leaves a stale participant badge.
      });
    }
  }, [leaveCall, setActiveCall]);

  useEffect(() => {
    if (!activeCall) {
      setCredentials(null);
      return;
    }

    let cancelled = false;

    createToken({
      workspaceId: activeCall.workspaceId,
      callId: activeCall.callId,
    })
      .then((result) => {
        if (!cancelled) {
          setCredentials({ url: result.url, token: result.token });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        toast.error(readErrorMessage(error, "Failed to join the huddle"));
        handleLeave();
      });

    return () => {
      cancelled = true;
    };
  }, [activeCall, createToken, handleLeave]);

  // Best effort: tell the server we left when the tab goes away.
  useEffect(() => {
    if (!activeCall) return;

    const onPageHide = () => {
      leaveCall({ callId: activeCall.callId }).catch(() => {});
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [activeCall, leaveCall]);

  if (!activeCall) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl",
        isExpanded
          ? "inset-4"
          : "bottom-4 right-4 h-[320px] w-[min(480px,calc(100vw-2rem))]"
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted px-3">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        <p className="truncate text-sm font-semibold">
          Huddle &middot; {activeCall.title}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Hint label={isExpanded ? "Shrink" : "Expand"}>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </Hint>
          <Hint label="Leave huddle">
            <Button
              variant="ghost"
              size="iconSm"
              className="text-rose-600 hover:text-rose-600"
              onClick={handleLeave}
            >
              <PhoneOff className="size-4" />
            </Button>
          </Hint>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-black">
        {credentials ? (
          <CallRoom
            serverUrl={credentials.url}
            token={credentials.token}
            onDisconnected={handleLeave}
            onError={(error) => {
              // Most often a credential mismatch: LiveKit reports it as
              // "could not establish signal connection: invalid token".
              toast.error(
                /invalid token/i.test(error.message)
                  ? "LiveKit rejected the token — check LIVEKIT_API_KEY and LIVEKIT_API_SECRET match the project behind LIVEKIT_URL."
                  : error.message || "The huddle connection failed"
              );
              handleLeave();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader className="size-5 animate-spin text-white/70" />
          </div>
        )}
      </div>
    </div>
  );
};
