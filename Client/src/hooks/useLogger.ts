// hooks/useLogger.ts
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_API_URL || "https://ugc-ads.onrender.com";

const getVisitorId = (): string => {
  let id = localStorage.getItem("_vid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("_vid", id);
  }
  return id;
};

const getSessionId = (): string => {
  let id = sessionStorage.getItem("_sid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("_sid", id);
  }
  return id;
};

export const useTracker = () => {
  const location = useLocation();
  const pageEntryTime = useRef<number>(0);
  const currentPath = useRef<string>(location.pathname);

  useEffect(() => {
    pageEntryTime.current = Date.now();
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const path = location.pathname;

    const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);

    if (currentPath.current !== path && timeOnPage > 0) {
      navigator.sendBeacon(
        `${BACKEND_URL}/api/metrics/pageview`,
        JSON.stringify({
          visitorId,
          sessionId,
          path: currentPath.current,
          timeOnPage,
        })
      );
    }

    fetch(`${BACKEND_URL}/api/metrics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, sessionId, path, timeOnPage: null }),
    }).catch(() => {});

    pageEntryTime.current = Date.now();
    currentPath.current = path;

    const handleUnload = () => {
      const secondsOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      navigator.sendBeacon(
        `${BACKEND_URL}/api/metrics/pageview`,
        JSON.stringify({ visitorId, sessionId, path, timeOnPage: secondsOnPage })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [location.pathname]);

  useEffect(() => {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest("button, a, [data-track]");
      if (!clickable) return;

      const element =
        clickable.getAttribute("data-track") ||
        clickable.textContent?.trim().slice(0, 50) ||
        clickable.tagName;

      fetch(`${BACKEND_URL}/api/metrics/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          sessionId,
          element,
          path: location.pathname,
        }),
      }).catch(() => {});
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [location.pathname]);
};