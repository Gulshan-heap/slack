import { useEffect, useState } from "react";

const ONLINE_THRESHOLD_MS = 30000;

export const useIsOnline = (lastSeen: number | undefined) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!lastSeen) return false;
  return now - lastSeen < ONLINE_THRESHOLD_MS;
};
