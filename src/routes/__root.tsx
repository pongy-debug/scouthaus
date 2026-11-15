import { SiteNav, SiteFooter } from "@/components/hh/SiteNav";
import { RoutePending } from "@/components/hh/RoutePending";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SpaceTransition } from "../components/hh/SpaceTransition";
import { PageTransitions } from "../components/hh/PageTransitions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "theme-color", content: "oklch(0.16 0.025 265)" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Scouthaus" },
      { name: "description", content: "Rental X-Ray for Durham renters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  pendingComponent: RoutePending,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ background: "var(--background, oklch(0.16 0.025 265))" }}>
      <head>
        <HeadContent />
      </head>
      <body style={{ background: "var(--background, oklch(0.16 0.025 265))" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PageTransitions />
      <IdleRoutes />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div className="p-3 pb-0"><SiteNav /></div>
      <div className="app-page"><Outlet /></div>
      <SiteFooter />
      {/* Shared page fade; mounted here so it survives route changes. */}
      <SpaceTransition />
      <Toaster theme="dark" position="bottom-center" />
    </QueryClientProvider>
  );
}

function IdleRoutes() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const preload = async () => {
      for (const options of [{ to: "/scanner" }, { to: "/" }, { to: "/find" }, { to: "/find/$city", params: { city: "durham" } }, { to: "/find/$city", params: { city: "newcastle" } }] as const) {
        if (cancelled) break;
        await router.preloadRoute(options).catch(() => {});
      }
    };
    const id = window.requestIdleCallback ? window.requestIdleCallback(() => void preload()) : window.setTimeout(() => void preload(), 1000);
    return () => { cancelled = true; if (window.cancelIdleCallback) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, [router]);
  return null;
}
