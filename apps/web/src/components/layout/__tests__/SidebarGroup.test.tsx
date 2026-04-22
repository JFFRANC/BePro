import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { Briefcase, LayoutDashboard } from "lucide-react";
import { renderWithRouter } from "./render-helpers";
import type { NavGroup } from "@/lib/nav-config";
import { SidebarGroup } from "../SidebarGroup";

const makeGroup = (overrides: Partial<NavGroup> = {}): NavGroup => ({
  id: "principal",
  label: "Principal",
  items: [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      gate: { kind: "roles", roles: ["admin"] },
      exactMatch: true,
    },
    {
      id: "jobs",
      label: "Vacantes",
      path: "/job-openings",
      icon: Briefcase,
      gate: { kind: "roles", roles: ["admin"] },
    },
  ],
  ...overrides,
});

describe("SidebarGroup", () => {
  afterEach(() => cleanup());

  it("renders the group label when provided and not collapsed", () => {
    renderWithRouter(
      <SidebarGroup
        group={makeGroup()}
        visibleItems={makeGroup().items}
        activeItemId={null}
        collapsed={false}
      />,
    );
    expect(screen.getByText("Principal")).not.toBeNull();
  });

  it("hides the group label when collapsed", () => {
    renderWithRouter(
      <SidebarGroup
        group={makeGroup()}
        visibleItems={makeGroup().items}
        activeItemId={null}
        collapsed={true}
      />,
    );
    const label = screen.queryByText("Principal");
    // Either removed from DOM or marked sr-only
    if (label) {
      expect(label.className).toContain("sr-only");
    }
  });

  it("renders nothing when visibleItems is empty", () => {
    const { container } = renderWithRouter(
      <SidebarGroup
        group={makeGroup()}
        visibleItems={[]}
        activeItemId={null}
        collapsed={false}
      />,
    );
    // SidebarGroup returns null when empty; no nav link, label, or list is emitted.
    expect(container.querySelectorAll("a").length).toBe(0);
    expect(container.querySelector("ul")).toBeNull();
    expect(screen.queryByText("Principal")).toBeNull();
  });

  it("omits the label when group has no label (dev group)", () => {
    const noLabel = makeGroup({ label: undefined });
    renderWithRouter(
      <SidebarGroup
        group={noLabel}
        visibleItems={noLabel.items}
        activeItemId={null}
        collapsed={false}
      />,
    );
    expect(screen.queryByText("Principal")).toBeNull();
  });

  it("marks only the item matching activeItemId as active", () => {
    const group = makeGroup();
    renderWithRouter(
      <SidebarGroup
        group={group}
        visibleItems={group.items}
        activeItemId="jobs"
        collapsed={false}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("data-active"),
    ).toBe("false");
    expect(
      screen.getByRole("link", { name: "Vacantes" }).getAttribute("data-active"),
    ).toBe("true");
  });
});
