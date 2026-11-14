import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContractScanner } from "./ContractScanner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/hh/pdf", () => ({
  readPdfText: vi.fn(async () => "3.2 Tenants must pay an administration fee of £150."),
}));
afterEach(cleanup);

describe("contract review workflow", () => {
  it("requires review before analysing samples, then clears stale results on edit", () => {
    render(<ContractScanner />);
    fireEvent.click(screen.getByRole("button", { name: "Load sample contract" }));
    expect(screen.queryByText(/Indicative risk/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analyse contract" }));
    expect(screen.getByText(/Indicative risk/)).toBeInTheDocument();
    expect(screen.getByText("Key contract information — source excerpts")).toBeInTheDocument();
    expect(screen.getByText("Ask the landlord:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Draft landlord email" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Negotiation email");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Contract text to review" }), {
      target: { value: "Updated contract" },
    });
    expect(screen.queryByText(/Indicative risk/)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("places uploaded PDF text in the editor without automatically analysing it", async () => {
    const { container } = render(<ContractScanner />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["pdf"], "lease.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Contract text to review" })).toHaveValue(
        "3.2 Tenants must pay an administration fee of £150.",
      ),
    );
    expect(screen.queryByText(/Indicative risk/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analyse contract" }));
    expect(screen.getByText(/£150 in flagged charges/)).toBeInTheDocument();
  });
});
