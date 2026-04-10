import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

describe("Primitive Components", () => {
  describe("Sheet", () => {
    it("renders SheetTrigger and applies data-slot attribute", () => {
      render(
        <Sheet>
          <SheetTrigger data-testid="trigger">Open</SheetTrigger>
        </Sheet>
      );
      const trigger = screen.getByTestId("trigger");
      expect(trigger).toBeTruthy();
      expect(trigger.getAttribute("data-slot")).toBe("sheet-trigger");
    });

    it("renders SheetHeader with data-slot attribute", () => {
      render(<SheetHeader data-testid="header">Header</SheetHeader>);
      const header = screen.getByTestId("header");
      expect(header.getAttribute("data-slot")).toBe("sheet-header");
    });

    it("renders SheetFooter with data-slot attribute", () => {
      render(<SheetFooter data-testid="footer">Footer</SheetFooter>);
      const footer = screen.getByTestId("footer");
      expect(footer.getAttribute("data-slot")).toBe("sheet-footer");
    });
  });

  describe("Switch", () => {
    it("renders with data-slot='switch'", () => {
      render(<Switch data-testid="switch" />);
      const switchEl = screen.getByTestId("switch");
      expect(switchEl.getAttribute("data-slot")).toBe("switch");
    });

    it("renders with size='sm' and applies data-size attribute", () => {
      render(<Switch data-testid="switch-sm" size="sm" />);
      const switchEl = screen.getByTestId("switch-sm");
      expect(switchEl.getAttribute("data-size")).toBe("sm");
    });

    it("renders with default size and applies data-size='default'", () => {
      render(<Switch data-testid="switch-default" />);
      const switchEl = screen.getByTestId("switch-default");
      expect(switchEl.getAttribute("data-size")).toBe("default");
    });
  });

  describe("ScrollArea", () => {
    it("renders with data-slot='scroll-area'", () => {
      render(
        <ScrollArea data-testid="scroll-area">
          <div>Content</div>
        </ScrollArea>
      );
      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea.getAttribute("data-slot")).toBe("scroll-area");
    });

    it("renders viewport with data-slot='scroll-area-viewport'", () => {
      const { container } = render(
        <ScrollArea>
          <div>Content</div>
        </ScrollArea>
      );
      const viewport = container.querySelector(
        "[data-slot='scroll-area-viewport']"
      );
      expect(viewport).not.toBeNull();
    });

    it("renders children inside the viewport", () => {
      render(
        <ScrollArea>
          <div data-testid="inner-content">Hello</div>
        </ScrollArea>
      );
      expect(screen.getByTestId("inner-content").textContent).toBe("Hello");
    });
  });

  describe("Collapsible", () => {
    it("renders with data-slot='collapsible'", () => {
      render(
        <Collapsible data-testid="collapsible">
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Hidden content</CollapsibleContent>
        </Collapsible>
      );
      const collapsible = screen.getByTestId("collapsible");
      expect(collapsible.getAttribute("data-slot")).toBe("collapsible");
    });

    it("renders CollapsibleTrigger with data-slot attribute", () => {
      render(
        <Collapsible>
          <CollapsibleTrigger data-testid="collapsible-trigger">Toggle</CollapsibleTrigger>
        </Collapsible>
      );
      const trigger = screen.getByTestId("collapsible-trigger");
      expect(trigger.getAttribute("data-slot")).toBe("collapsible-trigger");
    });

    it("renders CollapsibleContent with data-slot attribute when open", () => {
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent data-testid="content">
            Hidden content
          </CollapsibleContent>
        </Collapsible>
      );
      const content = screen.getByTestId("content");
      expect(content.getAttribute("data-slot")).toBe("collapsible-content");
    });
  });
});
