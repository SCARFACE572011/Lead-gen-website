// House copy for Supabase auth failures. The raw error.message from the API is
// developer-facing and must never reach the form UI, so the known error codes
// map to friendly copy here and everything else gets a generic fallback.

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

const RATE_LIMITED = "Too many attempts. Wait a minute and try again.";
const ALREADY_REGISTERED =
  "An account with this email already exists. Try logging in.";
const WEAK_PASSWORD =
  "That password is too easy to guess. Use at least 8 characters with a mix of letters, numbers, and symbols.";

const COPY: Record<string, string> = {
  invalid_credentials:
    "That email and password do not match. Try again or reset your password.",
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  over_request_rate_limit: RATE_LIMITED,
  over_email_send_rate_limit: RATE_LIMITED,
  weak_password: WEAK_PASSWORD,
  email_not_confirmed:
    "Confirm your email first. Check your inbox for the link we sent you.",
  same_password: "Your new password must be different from your current one.",
};

export function friendlyAuthError(
  error: AuthErrorLike,
  fallback = "Something went wrong on our end. Please try again."
): string {
  if (error.code && COPY[error.code]) return COPY[error.code];
  if (error.status === 429) return RATE_LIMITED;

  // Older gateway responses carry no code; recognize the common messages.
  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("invalid login credentials")) return COPY.invalid_credentials;
  if (message.includes("already registered")) return ALREADY_REGISTERED;
  if (message.includes("rate limit")) return RATE_LIMITED;
  if (message.includes("weak") && message.includes("password")) return WEAK_PASSWORD;

  return fallback;
}
