"use client";

import { useTranslations } from "next-intl";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "./use-speech-recognition";

/**
 * Voice-input toggle. Where the Web Speech API is unsupported it renders a
 * disabled mic with a tooltip rather than disappearing entirely. While listening
 * it pushes the live transcript into the chat input via `onTranscript`, and the
 * listening indicator respects reduced-motion (the pulse is disabled there).
 */
export function MicButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const t = useTranslations("assistant");
  const { supported, listening, permissionDenied, start, stop } =
    useSpeechRecognition(onTranscript);

  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled
        title={t("voice.unsupported")}
        aria-label={t("voice.unsupported")}
      >
        <MicOff />
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={listening ? "default" : "outline"}
        size="icon-sm"
        aria-pressed={listening}
        aria-label={listening ? t("voice.stop") : t("voice.start")}
        title={
          permissionDenied
            ? t("voice.denied")
            : listening
              ? t("voice.listening")
              : t("voice.start")
        }
        aria-describedby={permissionDenied ? "voice-denied" : undefined}
        onClick={() => (listening ? stop() : start())}
        className={listening ? "motion-safe:animate-pulse" : undefined}
      >
        <Mic />
      </Button>
      {permissionDenied ? (
        <p id="voice-denied" role="status" className="text-xs text-destructive">
          {t("voice.denied")}
        </p>
      ) : null}
    </>
  );
}
