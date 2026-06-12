"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

/**
 * Minimal local typings for the Web Speech API. The DOM lib does not guarantee
 * these globals, so we declare just the surface we use rather than depend on
 * ambient types or pull in a dependency.
 */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number } & Record<number, SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Map an app locale to a BCP-47 tag the recognizer understands. */
function recognitionLang(locale: string): string {
  return locale === "uk" ? "uk-UA" : "en-US";
}

// useSyncExternalStore gives us a client-true / server-false `supported` value
// without a setState-in-effect: the server snapshot is always false (no API),
// the client snapshot reflects actual capability, and React reconciles the
// difference at hydration without a manual mounted flag.
const subscribeNoop = () => () => {};
const isSupportedClient = () => getRecognitionCtor() != null;
const isSupportedServer = () => false;

export type UseSpeechRecognition = {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
};

/**
 * Feature-detected Web Speech recognition hook. Degrades gracefully where the
 * API is unsupported (`supported: false`, no-op start/stop). Sets `lang` from
 * the current locale, streams interim results to `onTranscript`, and cleans up
 * on unmount.
 */
export function useSpeechRecognition(
  onTranscript: (text: string) => void,
): UseSpeechRecognition {
  const locale = useLocale();
  const supported = useSyncExternalStore(
    subscribeNoop,
    isSupportedClient,
    isSupportedServer,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest callback without re-creating start().
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Restart a clean recognizer each time so lang reflects the current locale.
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = recognitionLang(locale);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let n = 0; n < event.results.length; n++) {
        text += event.results[n][0].transcript;
      }
      onTranscriptRef.current(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [locale]);

  return { supported, listening, start, stop };
}
