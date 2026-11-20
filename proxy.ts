import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
