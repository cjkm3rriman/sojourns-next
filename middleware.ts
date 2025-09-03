import { clerkMiddleware } from "@clerk/nextjs/server";

// Run Clerk on all routes so auth() works everywhere; keep these routes public
export default clerkMiddleware({
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)"]
});

// Apply to all app routes, excluding static files and _next internals, plus root and API
export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)"
  ]
};
