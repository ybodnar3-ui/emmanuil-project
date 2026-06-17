"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assistantSendAction,
  captureVoiceAction,
  type AssistantResult,
} from "../actions";
import { ProposalCard, type Proposal } from "./proposal-card";
import { MicButton } from "./mic-button";
import { Markdown } from "./markdown";

/**
 * An ephemeral chat thread (this phase does not persist ChatMessage). Each entry
 * is either the user's text or a typed assistant response. On send we optimistically
 * append the user message, call the server action, and append the result by kind:
 * answer/chat/clarify → text bubble, proposal → ProposalCard, error → localized
 * error bubble. Chrome is fully next-intl; the thread is an accessible log region.
 */
type Entry =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; result: AssistantResult };

// Known voice error codes map to localized strings; anything else → generic.
const VOICE_ERROR_CODES = [
  "NO_KEY",
  "TOO_LARGE",
  "REQUEST_FAILED",
  "EMPTY",
  "NO_AUDIO",
];

export function AssistantChat() {
  const t = useTranslations("assistant");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // Per-mount key counter: stable across HMR/navigation, no module state.
  const nextIdRef = useRef(0);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [entries, pending]);

  function send() {
    const text = value.trim();
    if (!text || pending || transcribing) return;
    setEntries((prev) => [...prev, { id: nextIdRef.current++, role: "user", text }]);
    setValue("");
    startTransition(async () => {
      let result: AssistantResult;
      try {
        result = await assistantSendAction(text);
      } catch {
        result = { kind: "error", code: "generic" };
      }
      setEntries((prev) => [...prev, { id: nextIdRef.current++, role: "assistant", result }]);
    });
  }

  // A recorded clip transcribes server-side, then fills the (editable) input. The
  // user reviews/edits and sends via the existing path — audio is never persisted.
  async function onRecorded(blob: Blob) {
    if (transcribing || pending) return;
    setVoiceError(null);
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "audio.webm");
      const r = await captureVoiceAction(fd);
      if (r.status === "ok") {
        setValue((prev) => (prev ? `${prev} ${r.text}` : r.text));
      } else {
        const key = VOICE_ERROR_CODES.includes(r.code)
          ? `voice.errors.${r.code}`
          : "voice.errors.generic";
        setVoiceError(key);
      }
    } catch {
      setVoiceError("voice.errors.generic");
    } finally {
      setTranscribing(false);
    }
  }

  const busy = pending || transcribing;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-busy={pending}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/60 p-4"
      >
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="font-heading text-lg text-foreground">
              {t("placeholder")}
            </p>
          </div>
        ) : null}

        {entries.map((entry) =>
          entry.role === "user" ? (
            <UserBubble key={entry.id} text={entry.text} />
          ) : (
            <AssistantEntry key={entry.id} result={entry.result} />
          ),
        )}

        {pending ? (
          <p className="text-sm text-muted-foreground">{t("thinking")}</p>
        ) : null}
        {transcribing ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("voice.transcribing")}
          </p>
        ) : null}
      </div>

      {voiceError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t(voiceError)}
        </p>
      ) : null}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <MicButton onRecorded={onRecorded} disabled={busy} />
        <Input
          aria-label={t("inputPlaceholder")}
          placeholder={t("inputPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" size="sm" disabled={busy || !value.trim()}>
          <Send />
          {t("send")}
        </Button>
      </form>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        {text}
      </p>
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function AssistantEntry({ result }: { result: AssistantResult }) {
  const t = useTranslations("assistant");

  switch (result.kind) {
    case "answer":
      return (
        <AssistantBubble>
          <Markdown>{result.answer}</Markdown>
        </AssistantBubble>
      );
    case "chat":
      return (
        <AssistantBubble>
          <Markdown>{result.reply}</Markdown>
        </AssistantBubble>
      );
    case "clarify":
      return (
        <AssistantBubble>
          <Markdown>{result.reply}</Markdown>
          <Link
            href="/people/new"
            className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
          >
            {t("clarify.createPerson")}
          </Link>
        </AssistantBubble>
      );
    case "proposal": {
      const proposal: Proposal = {
        personId: result.personId,
        personName: result.personName,
        facts: result.facts,
        interaction: result.interaction,
        keyDates: result.keyDates,
      };
      return <ProposalCard proposal={proposal} />;
    }
    case "error": {
      const code = result.code;
      // Map known stable codes to localized messages; fall back to generic.
      const known = ["EMPTY_INPUT", "REQUEST_FAILED", "PARSE_FAILED"];
      const key = known.includes(code) ? `errors.${code}` : "errors.generic";
      return (
        <div className="flex justify-start">
          <p
            role="status"
            className="max-w-[85%] rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t(key)}
          </p>
        </div>
      );
    }
  }
}
