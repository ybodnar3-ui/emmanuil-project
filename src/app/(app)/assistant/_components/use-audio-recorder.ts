"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Client-only MediaRecorder hook for the Assistant voice capture.
 *
 * - Feature-detected: `supported` is false where `navigator.mediaDevices.getUserMedia`
 *   or `window.MediaRecorder` is missing (server snapshot is always false so SSR/
 *   hydration is stable). No-op start/stop when unsupported.
 * - No-throw: a denied mic permission (or any getUserMedia failure) sets
 *   `permissionDenied`/`error` and leaves `recording=false` instead of throwing.
 * - Privacy/cleanup: `stop()` builds the recorded Blob, then stops every track to
 *   release the mic. The stream is also released on unmount. Audio is never stored
 *   here — the caller transcribes the Blob and drops it.
 *
 * `stop()` resolves the recorded `Blob` (audio/webm), or `null` if not recording.
 */

// useSyncExternalStore: client-true / server-false `supported` with no setState-in-effect.
const subscribeNoop = () => () => {};
function isSupportedClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}
const isSupportedServer = () => false;

export type UseAudioRecorder = {
  supported: boolean;
  recording: boolean;
  permissionDenied: boolean;
  error: boolean;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
};

export function useAudioRecorder(): UseAudioRecorder {
  const supported = useSyncExternalStore(
    subscribeNoop,
    isSupportedClient,
    isSupportedServer,
  );
  const [recording, setRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the mic if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore — the recorder may already be inactive.
      }
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, [releaseStream]);

  const start = useCallback(async () => {
    if (!isSupportedClient()) return;
    setPermissionDenied(false);
    setError(false);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Distinguish a denied permission from other failures so the UI can give
      // actionable feedback. Never throw.
      const name = (err as { name?: string } | null)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPermissionDenied(true);
      } else {
        setError(true);
      }
      setRecording(false);
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      releaseStream();
      setError(true);
      setRecording(false);
      return;
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }, [releaseStream]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setRecording(false);
      return null;
    }
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = chunksRef.current[0]?.type || "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      }
    });
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    return blob.size > 0 ? blob : null;
  }, [releaseStream]);

  return { supported, recording, permissionDenied, error, start, stop };
}
