"use client";

import { useTranslations } from "next-intl";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "./use-audio-recorder";

/**
 * Voice-capture toggle. Records audio with MediaRecorder and, on stop, hands the
 * recorded Blob up via `onRecorded` (the parent transcribes it server-side via
 * Groq). Where MediaRecorder/getUserMedia is unsupported it renders a disabled mic
 * with a tooltip rather than disappearing. A denied mic surfaces an actionable,
 * localized message. The recording pulse respects reduced-motion.
 *
 * `disabled` lets the parent lock the mic while a previous clip is transcribing.
 */
export function MicButton({
  onRecorded,
  disabled = false,
}: {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("assistant");
  const { supported, recording, permissionDenied, error, start, stop } =
    useAudioRecorder();

  if (!supported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled
        title={t("voice.notAvailable")}
        aria-label={t("voice.notAvailable")}
      >
        <MicOff />
      </Button>
    );
  }

  async function toggle() {
    if (recording) {
      const blob = await stop();
      if (blob) onRecorded(blob);
    } else {
      await start();
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={recording ? "default" : "outline"}
        size="icon-sm"
        disabled={disabled}
        aria-pressed={recording}
        aria-label={recording ? t("voice.stop") : t("voice.start")}
        title={
          permissionDenied
            ? t("voice.denied")
            : recording
              ? t("voice.recording")
              : t("voice.start")
        }
        aria-describedby={
          permissionDenied ? "voice-denied" : error ? "voice-error" : undefined
        }
        onClick={toggle}
        className={recording ? "motion-safe:animate-pulse" : undefined}
      >
        <Mic />
      </Button>
      {permissionDenied ? (
        <p id="voice-denied" role="status" className="text-xs text-destructive">
          {t("voice.denied")}
        </p>
      ) : error ? (
        <p id="voice-error" role="alert" className="text-xs text-destructive">
          {t("voice.errors.generic")}
        </p>
      ) : null}
    </>
  );
}
