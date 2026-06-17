import { describe, it, expect } from "vitest";
import { assembleTodayFeed, type FeedSources } from "../feed";

const now = new Date("2026-06-12T10:00:00.000Z");

function sources(overrides: Partial<FeedSources> = {}): FeedSources {
  return {
    contacts: [],
    birthdays: [],
    keyDates: [],
    tasks: [],
    ...overrides,
  };
}

describe("assembleTodayFeed", () => {
  it("returns [] for empty sources", () => {
    expect(assembleTodayFeed(sources(), now)).toEqual([]);
  });

  it("maps a contact with correct overdueDays (0 when due today)", () => {
    const feed = assembleTodayFeed(
      sources({
        contacts: [
          {
            personId: "p1",
            personName: "Ada",
            nextDueAt: new Date("2026-06-12T00:00:00.000Z"),
            intervalDays: 30,
          },
        ],
      }),
      now,
    );
    expect(feed).toEqual([
      {
        type: "contact",
        personId: "p1",
        personName: "Ada",
        reason: "cadence",
        dueAt: new Date("2026-06-12T00:00:00.000Z"),
        overdueDays: 0,
      },
    ]);
  });

  it("computes overdueDays from whole UTC days for an overdue contact", () => {
    const feed = assembleTodayFeed(
      sources({
        contacts: [
          {
            personId: "p1",
            personName: "Ada",
            nextDueAt: new Date("2026-06-09T00:00:00.000Z"),
            intervalDays: 30,
          },
        ],
      }),
      now,
    );
    expect(feed[0]).toMatchObject({ type: "contact", overdueDays: 3 });
  });

  it("maps a birthday with inDays", () => {
    const feed = assembleTodayFeed(
      sources({
        birthdays: [
          {
            personId: "p2",
            personName: "Bob",
            birthday: new Date("1990-06-15T00:00:00.000Z"),
          },
        ],
      }),
      now,
    );
    expect(feed[0]).toMatchObject({
      type: "birthday",
      personId: "p2",
      personName: "Bob",
      inDays: 3,
    });
  });

  it("maps a key date with inDays", () => {
    const feed = assembleTodayFeed(
      sources({
        keyDates: [
          {
            id: "k1",
            personId: "p2",
            personName: "Bob",
            label: "son's birthday",
            date: new Date("1990-06-15T00:00:00.000Z"),
            inDays: 3,
          },
        ],
      }),
      now,
    );
    expect(feed[0]).toMatchObject({
      type: "keydate",
      personId: "p2",
      personName: "Bob",
      label: "son's birthday",
      inDays: 3,
    });
  });

  it("interleaves key dates with birthdays by inDays (birthday before keydate at the same day)", () => {
    const feed = assembleTodayFeed(
      sources({
        birthdays: [
          {
            personId: "b-3",
            personName: "Zed",
            birthday: new Date("1990-06-15T00:00:00.000Z"), // in 3 days
          },
        ],
        keyDates: [
          {
            id: "k-1",
            personId: "k-1p",
            personName: "Amy",
            label: "anniversary",
            date: new Date("2000-06-13T00:00:00.000Z"), // in 1 day
            inDays: 1,
          },
          {
            id: "k-3",
            personId: "b-3", // same day as the birthday (3) — birthday wins the tie
            personName: "Zed",
            label: "wedding",
            date: new Date("2000-06-15T00:00:00.000Z"),
            inDays: 3,
          },
        ],
      }),
      now,
    );
    const kinds = feed.map((i) =>
      i.type === "keydate" ? `kd:${i.label}` : `bd:${i.personName}`,
    );
    expect(kinds).toEqual(["kd:anniversary", "bd:Zed", "kd:wedding"]);
  });

  it("maps a task with overdueDays", () => {
    const feed = assembleTodayFeed(
      sources({
        tasks: [
          {
            taskId: "t1",
            title: "Call the bank",
            personId: null,
            personName: null,
            dueAt: new Date("2026-06-10T00:00:00.000Z"),
          },
        ],
      }),
      now,
    );
    expect(feed[0]).toMatchObject({
      type: "task",
      taskId: "t1",
      title: "Call the bank",
      personId: null,
      overdueDays: 2,
    });
  });

  it("orders most-overdue contacts/tasks first, then today's birthdays, then upcoming", () => {
    const feed = assembleTodayFeed(
      sources({
        contacts: [
          {
            personId: "c-today",
            personName: "DueToday",
            nextDueAt: new Date("2026-06-12T00:00:00.000Z"),
            intervalDays: 30,
          },
          {
            personId: "c-old",
            personName: "VeryOverdue",
            nextDueAt: new Date("2026-06-05T00:00:00.000Z"),
            intervalDays: 30,
          },
        ],
        birthdays: [
          {
            personId: "b-today",
            personName: "BdayToday",
            birthday: new Date("1990-06-12T00:00:00.000Z"),
          },
          {
            personId: "b-soon",
            personName: "BdaySoon",
            birthday: new Date("1990-06-15T00:00:00.000Z"),
          },
        ],
        tasks: [
          {
            taskId: "t-old",
            title: "Old task",
            personId: null,
            personName: null,
            dueAt: new Date("2026-06-08T00:00:00.000Z"),
          },
        ],
      }),
      now,
    );

    // Overdue/due items (contacts+tasks) ranked by most-overdue first, then
    // today's birthday, then upcoming birthday last.
    const ids = feed.map((i) =>
      i.type === "contact" || i.type === "birthday" ? i.personId : i.taskId,
    );
    expect(ids).toEqual([
      "c-old", // 7 days overdue
      "t-old", // 4 days overdue
      "c-today", // 0 days overdue (due today)
      "b-today", // birthday today (inDays 0)
      "b-soon", // birthday in 3 days
    ]);
  });
});
