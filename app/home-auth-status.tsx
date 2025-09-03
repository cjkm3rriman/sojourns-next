"use client";
import Providers from "./providers";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function HomeAuthStatus() {
  return (
    <Providers>
      <div style={{ marginTop: 16 }}>
        <SignedIn>
          <span>Signed in</span>
          <div style={{ display: 'inline-block', marginLeft: 12 }}>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
        <SignedOut>
          <a href="/sign-in">Sign in</a> | <a href="/sign-up">Sign up</a>
        </SignedOut>
      </div>
    </Providers>
  );
}

