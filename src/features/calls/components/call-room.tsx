"use client";

import { Loader } from "lucide-react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";

import "@livekit/components-styles";

interface CallRoomProps {
  serverUrl: string;
  token: string;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

/**
 * The LiveKit media surface. Split into its own module so the dock can load
 * it with `ssr: false` — the SDK touches browser media APIs on import.
 */
export const CallRoom = ({
  serverUrl,
  token,
  onDisconnected,
  onError,
}: CallRoomProps) => {
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video
      onDisconnected={onDisconnected}
      onError={onError}
      className="h-full w-full"
      data-lk-theme="default"
    >
      <VideoConference />
    </LiveKitRoom>
  );
};

export const CallRoomFallback = () => (
  <div className="flex h-full items-center justify-center bg-black">
    <Loader className="size-5 animate-spin text-white/70" />
  </div>
);

export default CallRoom;
