import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PrimaryCTA } from "./PrimaryCTA";
import { useHaptic } from "./useHaptic";

afterEach(cleanup);

describe("PrimaryCTA (web surface)", () => {
  it("renders the label and fires onPress", () => {
    const onPress = vi.fn();
    render(<PrimaryCTA label="Continue" onPress={onPress} />);
    const btn = screen.getByRole("button", { name: "Continue" });
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("is disabled when not enabled", () => {
    render(
      <PrimaryCTA label="Next" onPress={() => {}} isEnabled={false} />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("useHaptic (web surface)", () => {
  it("returns safe no-ops", () => {
    const h = useHaptic();
    expect(() => {
      h.impact();
      h.notify("success");
      h.selection();
    }).not.toThrow();
  });
});
