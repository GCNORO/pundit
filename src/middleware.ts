import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Force the HTML shell to be re-requested every visit so a stale Vercel-CDN
// deploy can never be pinned for hours/days. Static JS/CSS chunks (with
// content-hashed filenames) still cache as normal.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  matcher: "/",
};
