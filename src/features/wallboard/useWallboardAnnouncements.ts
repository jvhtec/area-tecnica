import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

import type { AnnouncementLevel } from "@/constants/announcementLevels";
import type { TickerMessage } from "./types";

type AnnouncementRow = { id?: string; message?: string | null; level?: string | null; created_at?: string | null };

export const useWallboardAnnouncements = (
  highlightTtlMs: number,
  setHighlightJobs: Dispatch<SetStateAction<Map<string, number>>>,
  setTickerMsgs: Dispatch<SetStateAction<TickerMessage[]>>,
) => {
  useEffect(() => {
    const id = window.setInterval(() => {
      setHighlightJobs((previous) => {
        const now = Date.now();
        const next = new Map(previous);
        for (const [jobId, expiresAt] of next) {
          if (expiresAt < now) next.delete(jobId);
        }
        return next.size === previous.size ? previous : next;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [setHighlightJobs]);

  return useCallback((rows: AnnouncementRow[]) => {
    const regex = /^\s*\[HIGHLIGHT_JOB:([a-f0-9-]+)\]\s*/i;
    const now = Date.now();
    const ttl = Math.max(1000, highlightTtlMs);
    const staleIds: string[] = [];
    const messages: TickerMessage[] = [];

    setHighlightJobs((previous) => {
      const updated = new Map(previous);
      rows.forEach((announcement) => {
        let message = announcement.message || "";
        const rawLevel = (announcement.level ?? "info") as AnnouncementLevel;
        const level: AnnouncementLevel = ["info", "warn", "critical"].includes(rawLevel) ? rawLevel : "info";
        const match = message.match(regex);
        if (match) {
          const createdAt = announcement.created_at ? new Date(announcement.created_at).getTime() : now;
          const expiresAt = createdAt + ttl;
          if (expiresAt > now) updated.set(match[1], expiresAt);
          else if (announcement.id) staleIds.push(announcement.id);
          message = message.replace(regex, "");
        }
        if (message.trim()) messages.push({ message: message.trim(), level });
      });
      for (const [jobId, expiresAt] of updated) {
        if (expiresAt < now) updated.delete(jobId);
      }
      return updated;
    });

    setTickerMsgs(messages);
    return staleIds;
  }, [highlightTtlMs, setHighlightJobs, setTickerMsgs]);
};
