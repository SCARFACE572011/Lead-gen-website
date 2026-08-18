import type { Metadata } from "next";

// The shared (auth) layout titles every auth screen "Sign in", which mislabels
// this route in the browser tab and history. Scope the correct name here; the
// root template appends "| LeadZipp" and the parent layout's noindex still
// applies.
export const metadata: Metadata = {
  title: "Create your account",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
