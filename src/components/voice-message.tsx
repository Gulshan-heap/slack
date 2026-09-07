interface VoiceMessageProps {
  url: string | null | undefined;
  durationMs?: number;
}

const formatDuration = (ms?: number) => {
  if (!ms) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const VoiceMessage = ({ url, durationMs }: VoiceMessageProps) => {
  if (!url) return null;

  const duration = formatDuration(durationMs);

  return (
    <div className="my-2 flex items-center gap-x-2 max-w-[320px]">
      <audio controls src={url} className="h-10 w-full" preload="metadata" />
      {duration && (
        <span className="text-xs text-muted-foreground shrink-0">{duration}</span>
      )}
    </div>
  );
};
