import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect
} from "@convex-dev/auth/nextjs/server";

const isPublicPage = createRouteMatcher(["/auth"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthed = await convexAuth.isAuthenticated();

  if (!isPublicPage(request) && !isAuthed) {
    return nextjsMiddlewareRedirect(request, "/auth");
  }

  if (isPublicPage(request) && isAuthed) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
