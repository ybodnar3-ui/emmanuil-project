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
};

const UK: ReminderLabels = {
  header: "Ваш день із людьми",
  contacts: "Зв'язатися",
  birthdays: "Дні народження",
  tasks: "Завдання",
};

const contact: FeedItem = {
  type: "contact",
  personId: "p1",
  personName: "Ada Lovelace",
  reason: "cadence",
  dueAt: new Date("2026-06-10T00:00:00.000Z"),
  overdueDays: 3,
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

  it("HTML-escapes user-provided names so markup can't be injected", () => {
    const evil: FeedItem = {
      ...contact,
      personName: "<b>x</b> & <script>alert(1)</script>",
    };
    const out = formatReminderMessage([evil], EN) as string;
    expect(out).not.toContain("<b>x</b>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(out).toContain("&amp;");
  });

  it("HTML-escapes user-provided task titles", () => {
    const evil: FeedItem = { ...task, title: "ship <i>v2</i>" };
    const out = formatReminderMessage([evil], EN) as string;
    expect(out).not.toContain("<i>v2</i>");
    expect(out).toContain("ship &lt;i&gt;v2&lt;/i&gt;");
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
