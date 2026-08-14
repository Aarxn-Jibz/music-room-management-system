import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "rejoy-dev-secret-change-me-in-production";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;

  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      return NextResponse.next();
    } catch {
      // Invalid or expired token; fall through to redirect.
    }
  }

  const url = new URL("/SignIn", req.url);
  url.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|SignIn|RoomBooking|home).+)"],
};
