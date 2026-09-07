"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

interface VoiceRecorderButtonProps {
  onRecorded: (blob: Blob, durationMs: number) => void;
  disabled?: boolean;
}

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const VoiceRecorderButton = ({
  onRecorded,
  disabled,
}: VoiceRecorderButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (durationMs > 400) {
          onRecorded(blob, durationMs);
        }
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setIsRecording(true);
      setElapsedMs(0);

      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch {
      // Mic permission denied or unavailable; silently no-op.
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-x-2">
        <span className="flex items-center gap-x-1.5 text-xs text-rose-600">
          <span className="size-2 rounded-full bg-rose-600 animate-pulse" />
          {formatElapsed(elapsedMs)}
        </span>
        <Hint label="Stop recording">
          <Button
            size="iconSm"
            variant="ghost"
            onClick={stopRecording}
            className={cn("text-rose-600")}
          >
            <Square className="size-4" />
          </Button>
        </Hint>
      </div>
    );
  }

  return (
    <Hint label="Record a voice message">
      <Button
        disabled={disabled}
        size="iconSm"
        variant="ghost"
        onClick={startRecording}
      >
        <Mic className="size-4" />
      </Button>
    </Hint>
  );
};
