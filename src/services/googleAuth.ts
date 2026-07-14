/**
 * Verify a Google Sign-In ID token (GIS credential) against GOOGLE_CLIENT_ID.
 * Uses Google's tokeninfo endpoint so we don't need an extra OAuth library.
 */

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export function googleAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID ?? "").trim();
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  if (!clientId) {
    throw Object.assign(new Error("Google sign-in is not configured (set GOOGLE_CLIENT_ID)"), {
      code: "google_unconfigured",
      status: 501,
    });
  }
  if (!idToken || idToken.length < 20) {
    throw Object.assign(new Error("missing Google ID token"), { code: "invalid_token", status: 400 });
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  const data = (await res.json().catch(() => null)) as Record<string, string> | null;
  if (!res.ok || !data) {
    throw Object.assign(new Error("invalid Google ID token"), { code: "invalid_token", status: 401 });
  }
  // aud may be a single client id; azp is the authorized party for some token shapes.
  const audience = data.aud || data.azp;
  if (audience !== clientId) {
    throw Object.assign(new Error("Google token audience mismatch"), { code: "invalid_token", status: 401 });
  }
  const email = (data.email ?? "").trim().toLowerCase();
  if (!email) {
    throw Object.assign(new Error("Google account has no email"), { code: "no_email", status: 400 });
  }
  const verified = String(data.email_verified) === "true";
  if (!verified) {
    throw Object.assign(new Error("Google email is not verified"), { code: "email_unverified", status: 403 });
  }
  return {
    sub: data.sub,
    email,
    emailVerified: true,
    name: (data.name ?? "").trim() || null,
    picture: data.picture ?? null,
  };
}
