import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#020817", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link href="/studio" style={{ color: "#93c5fd", fontWeight: 800, textDecoration: "none", fontSize: 14 }}>
            ← WorkflowOS
          </Link>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 12 }}>Sign in to use AI features</p>
        </div>
        <SignIn fallbackRedirectUrl="/studio" />
      </div>
    </div>
  );
}
