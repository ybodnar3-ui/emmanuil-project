import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/server/today/feed";
import { formatPushPayload, type PushLabels } from "../format";

const labels: PushLabels = {
  header: "Your day with people",
  contacts: "People to reach out to",
  birthdays: "Birthdays & dates",
  tasks: "Tasks",
  keyDate: "Wish {name} — {label} ({when})",
  keyDateToday: "today",
  keyDateInDays: "in {n} days",
};

const contact: FeedItem = {
  type: "contact",
  personId: "p1",
  personName: "Maria",
  reason: "cadence",
  dueAt: new Date("2026-06-22T00:00:00.000Z"),
  overdueDays: 0,
  prompt: "Ask how the fundraising is going",
};

const keyDate: FeedItem = {
  type: "keydate",
  id: "k1",
  personId: "p2",
  personName: "Andrii",
  label: "son's birthday",
  date: new Date("2010-06-22T00:00:00.000Z"),
  inDays: 0,
};

describe("formatPushPayload", () => {
  it("returns null for an empty feed", () => {
    expect(formatPushPayload([], labels)).toBeNull();
  });

  it("uses the header as the title and opens the app at /", () => {
    const p = formatPushPayload([contact], labels);
    expect(p).not.toBeNull();
    expect(p!.title).toBe("Your day with people");
    expect(p!.url).toBe("/");
  });

  it("includes the contact's name and a key-date greeting in the body", () => {
    const p = formatPushPayload([contact, keyDate], labels);
    expect(p!.body).toContain("Maria");
    expect(p!.body).toContain("Wish Andrii — son's birthday (today)");
  });

  it("renders 'in N days' for a future key date", () => {
    const p = formatPushPayload([{ ...keyDate, inDays: 3 }], labels);
    expect(p!.body).toContain("in 3 days");
  });
});
