import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Done!")}>Trigger success</button>
      <button onClick={() => toast.error("Bad!")}>Trigger error</button>
    </div>
  );
}

describe("Toast", () => {
  it("provides toast context", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    expect(screen.getByText("Trigger success")).toBeInTheDocument();
    expect(screen.getByText("Trigger error")).toBeInTheDocument();
  });

  it("shows toast message on trigger", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Trigger success"));
    expect(screen.getByText("Done!")).toBeInTheDocument();
  });

  it("shows error toast message", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText("Trigger error"));
    expect(screen.getByText("Bad!")).toBeInTheDocument();
  });

  it("throws when used outside provider", () => {
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow("useToast must be used within ToastProvider");
  });
});
