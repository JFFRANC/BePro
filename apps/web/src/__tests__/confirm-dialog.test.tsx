import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialogProvider, useConfirm } from "@/components/confirm-dialog";

function TestConsumer({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button onClick={async () => {
      const result = await confirm({
        title: "Delete?",
        description: "This cannot be undone.",
        confirmLabel: "Delete",
        variant: "destructive",
      });
      onResult(result);
    }}>
      Trigger
    </button>
  );
}

describe("ConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("resolves true when confirmed", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>
    );

    await userEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("Delete?")).toBeDefined();
    await userEvent.click(screen.getByText("Delete"));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("resolves false when cancelled", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>
    );

    await userEvent.click(screen.getByText("Trigger"));
    await userEvent.click(screen.getByText("Cancelar"));
    expect(onResult).toHaveBeenCalledWith(false);
  });
});
