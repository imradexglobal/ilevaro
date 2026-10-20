import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState } from "@/components/ui/States";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("is disabled while loading", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when clicked", async () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    btn.click();
    expect(clicked).toBe(true);
  });
});

describe("Badge", () => {
  it("renders text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("associates error with input via aria-invalid", () => {
    render(<Input label="Email" error="Bad" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("States", () => {
  it("renders empty state", () => {
    render(<EmptyState title="Nothing here" message="Add a record" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add a record")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<ErrorState title="Failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
