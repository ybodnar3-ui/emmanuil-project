import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/locale", () => ({ getLocaleFromCookie: async () => "en" }));

import PrivacyPage from "../privacy/page";
import TermsPage from "../terms/page";

describe("legal pages", () => {
  it("privacy renders its title and sections", async () => {
    render(await PrivacyPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Who we are")).toBeInTheDocument();
  });
  it("terms renders its title", async () => {
    render(await TermsPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeInTheDocument();
  });
});
