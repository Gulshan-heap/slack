"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";

interface TrendPoint {
  date: string;
  avgSentiment: number;
  messageCount: number;
}

interface SentimentTrendChartProps {
  data: TrendPoint[];
}

const WIDTH = 640;
const HEIGHT = 180;
const PADDING_X = 12;
const PADDING_Y = 16;

export const SentimentTrendChart = ({ data }: SentimentTrendChartProps) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => {
    if (data.length === 0) return [];

    const innerWidth = WIDTH - PADDING_X * 2;
    const innerHeight = HEIGHT - PADDING_Y * 2;
    const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

    return data.map((d, i) => {
      const x = PADDING_X + step * i;
      // sentiment in [-1, 1] -> y in [PADDING_Y, HEIGHT - PADDING_Y], inverted
      const clamped = Math.max(-1, Math.min(1, d.avgSentiment));
      const y = PADDING_Y + ((1 - clamped) / 2) * innerHeight;
      return { x, y, ...d };
    });
  }, [data]);

  const hasActivity = data.some((d) => d.messageCount > 0);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const zeroY = PADDING_Y + (HEIGHT - PADDING_Y * 2) / 2;

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relativeX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIndex(closest);
  };

  if (!hasActivity) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        No message activity in this period yet.
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-[180px]"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Team sentiment trend over time"
      >
        <line
          x1={PADDING_X}
          y1={zeroY}
          x2={WIDTH - PADDING_X}
          y2={zeroY}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path
          d={linePath}
          fill="none"
          className="stroke-sky-600 dark:stroke-sky-400"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={PADDING_Y}
              x2={hovered.x}
              y2={HEIGHT - PADDING_Y}
              className="stroke-border"
              strokeWidth={1}
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              className="fill-sky-600 dark:fill-sky-400 stroke-background"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <p className="font-medium">{format(parseISO(hovered.date), "MMM d")}</p>
          <p className="text-muted-foreground">
            {hovered.messageCount} messages · sentiment {hovered.avgSentiment.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
};
