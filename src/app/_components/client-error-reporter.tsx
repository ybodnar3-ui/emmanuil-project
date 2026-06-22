"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error";

/**
 * Renders nothing. Registers global handlers so uncaught errors and unhandled
 * promise rejections (outside React's render path) reach Vercel logs via the
 * client-error bridge. React render crashes are covered by the error boundaries.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      reportClientError(e.error ?? e.message, "window");
    const onRejection = (e: PromiseRejectionEvent) =>
      reportClientError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
