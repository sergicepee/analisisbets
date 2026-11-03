import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, createAuthServer } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (authConfigured()) await createAuthServer().auth.signOut();
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set("pickzone_developer_subscription_preview", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
