import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const loaded = vi.hoisted(() => vi.fn());
vi.mock("@/components/hh/ScannerSession", () => {
  loaded();
  return { ScannerSession: () => <div>Reader ready</div> };
});
import { ContractScanner } from "@/components/hh/ContractScanner";
afterEach(cleanup);
it("renders an interactive upload shell without loading processing until the sample is requested", async () => {
  render(<ContractScanner />);
  expect(screen.getByRole("heading", { name: "Contract Check" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Choose a file" })).toBeEnabled();
  expect(loaded).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  expect(screen.getByRole("status")).toHaveTextContent("Loading contract reader");
  expect(await screen.findByText("Reader ready")).toBeVisible();
  expect(loaded).toHaveBeenCalledOnce();
});
