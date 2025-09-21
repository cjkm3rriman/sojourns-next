import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes (no auth required)
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

// Protect everything else
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  await auth.protect();
});

// Apply to all app routes, excluding static files and _next internals, plus root and API
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
