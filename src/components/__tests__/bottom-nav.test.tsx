import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BottomNav } from "@/components/bottom-nav";
import en from "../../../messages/en.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("BottomNav", () => {
  it("renders all four localized tabs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("marks the active tab with aria-current", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Today").closest("a")).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive tabs with aria-current", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("People").closest("a")).not.toHaveAttribute("aria-current");
  });
});
