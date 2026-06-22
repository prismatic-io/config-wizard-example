import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

/**
 * Backend JWT signing endpoint for the Prismatic embedded SDK.
 *
 * SECURITY: The private signing key lives here, on the server, only. It is never
 * sent to the browser. The frontend calls this route, receives a short-lived
 * signed JWT, and passes it to `prismatic.authenticate({ token })`.
 *
 * This is a barebones demo: the "customer user" is hardcoded via env vars rather
 * than derived from a real login/session. In a production app you would read the
 * authenticated user from your session and map them to a Prismatic customer.
 */
export async function GET() {
  const privateKey = process.env.PRISMATIC_SIGNING_KEY;
  const orgId = process.env.PRISMATIC_ORG_ID;

  // Placeholder env values keep the app running; the UI shows a "needs
  // credentials" state instead of crashing the SDK with an invalid token.
  if (!privateKey || !orgId) {
    return NextResponse.json(
      {
        error:
          "Signing key not configured. Set PRISMATIC_SIGNING_KEY and PRISMATIC_ORG_ID in .env.local.",
      },
      { status: 503 },
    );
  }

  // Hardcoded demo customer/user (see .env.example).
  const customerExtId = process.env.PRISMATIC_CUSTOMER_EXT_ID ?? "demo-customer";
  const customerName = process.env.PRISMATIC_CUSTOMER_NAME ?? "Demo Customer";
  const userId = process.env.PRISMATIC_DEMO_USER_ID ?? "demo-user-1";
  const userName = process.env.PRISMATIC_DEMO_USER_NAME ?? "Demo User";

  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = currentTime + 600; // 10 minutes

  let token: string;
  try {
    token = jwt.sign(
      {
        sub: userId,
        external_id: userId,
        name: userName,
        // `organization` and `customer` are Prismatic-specific claims — they are
        // NOT standard JWT fields and must be set explicitly.
        organization: orgId,
        customer: customerExtId,
        // If no customer with this `customer` id exists yet, Prismatic creates
        // one with this name.
        customer_name: customerName,
        iat: currentTime - 5, // small buffer for clock skew
        exp: expiresAt,
      },
      // Normalize escaped newlines so single-line .env values still parse as PEM.
      privateKey.replace(/\\n/g, "\n"),
      { algorithm: "RS256" },
    );
  } catch (err) {
    console.error("Failed to sign Prismatic JWT:", err);
    return NextResponse.json(
      { error: "Failed to sign token. Check that PRISMATIC_SIGNING_KEY is a valid RSA private key." },
      { status: 500 },
    );
  }

  return NextResponse.json({ token, expiresAt });
}
