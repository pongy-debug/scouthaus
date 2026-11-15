import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Starfield } from "@/components/hh/Starfield";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps stars aligned with the viewport inside an offset panel and after resizing", () => {
  let top = 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ left: 12, top } as DOMRect));
  const { container } = render(<Starfield />);
  const sky = container.querySelector("svg");
  expect(sky).toHaveStyle({ left: "-12px", top: "-120px", width: "100vw", height: "100svh" });
  top = 90;
  fireEvent(window, new Event("resize"));
  expect(sky).toHaveStyle({ top: "-90px" });
});
