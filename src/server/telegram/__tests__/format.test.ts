import { describe, it, expect } from "vitest";
import { formatReminderMessage, type ReminderLabels } from "../format";
import type { FeedItem } from "@/server/today/feed";

/**
 * Contract for the pure reminder formatter:
 *  - each source type (contact / birthday / task) renders its own line
 *  - an empty feed returns null so the caller skips sending
 *  - user-provided text (names, task titles) is HTML-escaped (no injection)
 *  - the header + section labels are caller-supplied (localized), so the fn is
 *    pure: no next-intl, no Date.now, no I/O.
 */

const EN: ReminderLabels = {
  header: "Your day with people",
  contacts: "Reach out",
  birthdays: "Birthdays",
  tasks: "Tasks",
  more: "+{n} more",
};

const UK: ReminderLabels = {
  header: "Ваш день із людьми",
  contacts: "Зв'язатися",
  birthdays: "Дні народження",
  tasks: "Завдання",
  more: "+ще {n}",
};

const contact: FeedItem = {
  type: "contact",
  personId: "p1",
  personName: "Ada Lovelace",
  reason: "cadence",
  dueAt: new Date("2026-06-10T00:00:00.000Z"),
  overdueDays: 3,
  prompt: "Ask how her new role is going.",
};

const birthday: FeedItem = {
  type: "birthday",
  personId: "p2",
  personName: "Alan Turing",
  birthday: new Date("1912-06-13T00:00:00.000Z"),
  inDays: 0,
};

const task: FeedItem = {
  type: "task",
  taskId: "t1",
  title: "Send proposal",
  personId: null,
  personName: null,
  dueAt: new Date("2026-06-13T00:00:00.000Z"),
  overdueDays: 0,
};

describe("formatReminderMessage", () => {
  it("returns null for an empty feed", () => {
    expect(formatReminderMessage([], EN)).toBeNull();
  });

  it("renders a line for each source type", () => {
    const out = formatReminderMessage([contact, birthday, task], EN);
    expect(out).not.toBeNull();
    const msg = out as string;
    expect(msg).toContain("Ada Lovelace");
    expect(msg).toContain("Alan Turing");
    expect(msg).toContain("Send proposal");
  });

  it("includes the localized header (EN)", () => {
    const out = formatReminderMessage([task], EN) as string;
    expect(out).toContain("Your day with people");
  });

  it("includes the localized header (UK)", () => {
    const out = formatReminderMessage([task], UK) as string;
    expect(out).toContain("Ваш день із людьми");
  });

  it("groups items under their localized section labels", () => {
    const out = formatReminderMessage([contact, birthday, task], EN) as string;
    expect(out).toContain("Reach out");
    expect(out).toContain("Birthdays");
    expect(out).toContain("Tasks");
  });

  it("renders each contact's personalized prompt under their name", () => {
    const out = formatReminderMessage([contact], EN) as string;
    expect(out).toContain("Ada Lovelace");
    expect(out).toContain("Ask how her new role is going.");
  });

  it("HTML-escapes the contact prompt so markup can't be injected", () => {
    const evil: FeedItem = {
      ...contact,
      prompt: "Ask <b>about</b> & <script>alert(1)</script>",
    };
    const out = formatReminderMessage([evil], EN) as string;
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;b&gt;about&lt;/b&gt;");
    expect(out).toContain("&amp;");
  });

  it("HTML-escapes user-provided names so markup can't be injected", () => {
    const evil: FeedItem = {
      ...contact,
      personName: "<i>x</i> & friends",
    };
    const out = formatReminderMessage([evil], EN) as string;
    expect(out).not.toContain("<i>x</i>");
    expect(out).toContain("&lt;i&gt;x&lt;/i&gt;");
    expect(out).toContain("&amp;");
  });

  it("HTML-escapes user-provided task titles", () => {
    const evil: FeedItem = { ...task, title: "ship <i>v2</i>" };
    const out = formatReminderMessage([evil], EN) as string;
    expect(out).not.toContain("<i>v2</i>");
    expect(out).toContain("ship &lt;i&gt;v2&lt;/i&gt;");
  });

  it("truncates a huge feed under the Telegram limit and appends the +N more line", () => {
    // Build far more contacts than can fit, each with a long prompt, so the
    // formatter must drop some to stay under the 4096-char hard limit.
    const huge: FeedItem[] = Array.from({ length: 200 }, (_, i) => ({
      type: "contact" as const,
      personId: `p${i}`,
      personName: `Person Number ${i}`,
      reason: "cadence" as const,
      dueAt: new Date("2026-06-10T00:00:00.000Z"),
      overdueDays: 1,
      prompt: "A".repeat(120),
    }));
    const out = formatReminderMessage(huge, EN) as string;
    expect(out).not.toBeNull();
    // Stays comfortably under Telegram's 4096-char hard limit.
    expect(out.length).toBeLessThan(4096);
    // Some items were dropped, so the localized "+N more" line is present with a count.
    expect(out).toMatch(/\+\d+ more/);
  });

  it("does not append +N more when everything fits", () => {
    const out = formatReminderMessage([contact, birthday, task], EN) as string;
    expect(out).not.toMatch(/\+\d+ more/);
  });

  it("renders a task linked to a person with the escaped person name", () => {
    const linked: FeedItem = {
      ...task,
      personId: "p9",
      personName: "Grace <Hopper>",
    };
    const out = formatReminderMessage([linked], EN) as string;
    expect(out).toContain("Grace &lt;Hopper&gt;");
    expect(out).not.toContain("<Hopper>");
  });
});
