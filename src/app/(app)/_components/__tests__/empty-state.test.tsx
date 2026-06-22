import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the title always", () => {
    render(<EmptyState title="Add your first person" />);
    expect(screen.getByText("Add your first person")).toBeInTheDocument();
  });

  it("renders the CTA with href + label when provided", () => {
    render(
      <EmptyState
        title="t"
        action={{ href: "/people/new", label: "Add person" }}
      />,
    );
    // The CTA uses the Button-as-Link pattern (base-ui forces role="button"
    // even though it renders an <a>), so query by accessible name and assert
    // it is an anchor pointing at the action href.
    const cta = screen.getByRole("button", { name: "Add person" });
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", "/people/new");
  });

  it("renders the secondary link when provided", () => {
    render(
      <EmptyState
        title="t"
        secondary={{ href: "/assistant", label: "Tell the assistant" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Tell the assistant" }),
    ).toHaveAttribute("href", "/assistant");
  });

  it("omits CTA + secondary when not provided", () => {
    render(<EmptyState title="t" description="d" />);
    expect(screen.queryByRole("link")).toBeNull();
    // The CTA renders as role="button" (Button-as-Link), so assert it's absent too.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("d")).toBeInTheDocument();
  });
});
