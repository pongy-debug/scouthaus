import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  block: null as
    | null
    | ((args: {
        current: { pathname: string };
        next: { pathname: string };
      }) => boolean | Promise<boolean>),
  resolved: null as null | (() => void),
  unsubscribe: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useBlocker: (options: { shouldBlockFn: typeof state.block; enableBeforeUnload: boolean }) => {
    state.block = options.shouldBlockFn;
    expect(options.enableBeforeUnload).toBe(false);
  },
  useRouter: () => ({
    subscribe: (_event: string, cb: () => void) => {
      state.resolved = cb;
      return state.unsubscribe;
    },
  }),
}));
import { PageTransitions } from "@/components/hh/PageTransitions";
import { SpaceTransition } from "@/components/hh/SpaceTransition";
import { resetSpaceFlight } from "@/lib/hh/transition";
afterEach(() => {
  cleanup();
  resetSpaceFlight();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it.each([
  ["/find", "/find/durham"],
  ["/tour/first-ruth-house", "/"],
])("fades %s to %s before navigation and reveals after resolution", async (from, to) => {
  vi.useFakeTimers();
  render(
    <>
      <PageTransitions />
      <SpaceTransition />
    </>,
  );
  let result: boolean | Promise<boolean> = true;
  act(() => {
    result = state.block!({ current: { pathname: from }, next: { pathname: to } });
  });
  const allowed = vi.fn();
  void Promise.resolve(result).then(allowed);
  expect(document.querySelector(".space-fade")).not.toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(149);
  });
  expect(allowed).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(allowed).toHaveBeenCalledWith(false);
  expect(document.querySelector(".space-fade")).not.toBeNull();
  await act(async () => {
    state.resolved!();
  });
  expect(document.querySelector(".space-fadein")).not.toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(document.documentElement).not.toHaveClass("space-lock");
  expect(state.unsubscribe).toHaveBeenCalled();
});

it("leaves same-page map/filter navigation immediate", () => {
  render(<PageTransitions />);
  expect(
    state.block!({ current: { pathname: "/find/durham" }, next: { pathname: "/find/durham/" } }),
  ).toBe(false);
  expect(document.documentElement).not.toHaveClass("space-lock");
});

it.each(["/", "/find", "/find/durham", "/find/newcastle"])(
  "animates navigation from %s to scanner",
  (path) => {
    render(<PageTransitions />);
    expect(
      state.block!({ current: { pathname: path }, next: { pathname: "/scanner" } }),
    ).toBeInstanceOf(Promise);
    expect(document.documentElement).toHaveClass("space-lock");
  },
);

it.each(["/", "/find", "/find/durham", "/find/newcastle"])(
  "animates navigation from scanner to %s",
  (path) => {
    render(<PageTransitions />);
    expect(
      state.block!({ current: { pathname: "/scanner" }, next: { pathname: path } }),
    ).toBeInstanceOf(Promise);
    expect(document.documentElement).toHaveClass("space-lock");
  },
);

it("still animates navigation when reduced motion is requested", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(<PageTransitions />);
  void state.block!({ current: { pathname: "/" }, next: { pathname: "/find" } });
  expect(document.documentElement).toHaveClass("space-lock");
  vi.unstubAllGlobals();
});
