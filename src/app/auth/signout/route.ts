import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, createAuthServer } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (authConfigured()) await createAuthServer().auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
