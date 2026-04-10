import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

describe("US4 — Component Patterns", () => {
  it("T035: Button renders with variant='default' and applies bg-primary class", () => {
    render(<Button>Click</Button>);
    const button = screen.getByRole("button", { name: "Click" });
    expect(button.className).toContain("bg-primary");
  });

  it("T036: Input renders with error={true} and applies aria-invalid", () => {
    render(<Input error={true} placeholder="Email" />);
    const input = screen.getByPlaceholderText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("T037: Card renders and applies bg-card class", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("bg-card");
  });
});
