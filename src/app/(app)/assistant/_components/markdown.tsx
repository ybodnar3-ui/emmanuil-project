"use client";

import ReactMarkdown from "react-markdown";

/**
 * Renders assistant message text as Markdown. Raw HTML is intentionally NOT
 * enabled (react-markdown ignores it by default and we do not add rehype-raw),
 * so model output cannot inject markup — this keeps the surface XSS-safe.
 *
 * Styling mirrors the assistant bubble: small text with modest vertical spacing
 * for paragraphs and lists so multi-paragraph / bulleted answers stay readable
 * on mobile without pulling in a full prose plugin.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_li]:ml-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
