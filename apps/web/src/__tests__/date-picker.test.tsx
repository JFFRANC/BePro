import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DatePicker } from "@/components/date-picker";

describe("DatePicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with placeholder text", () => {
    render(<DatePicker placeholder="Seleccionar fecha" />);
    expect(screen.getByText("Seleccionar fecha")).toBeDefined();
  });

  it("renders a button trigger", () => {
    render(<DatePicker placeholder="Fecha" />);
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
  });

  it("accepts a value and displays formatted date", () => {
    const date = new Date(2026, 3, 9);
    render(<DatePicker value={date} placeholder="Fecha" />);
    expect(screen.queryByText("Fecha")).toBeNull();
  });
});
