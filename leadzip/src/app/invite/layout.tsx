import type { Metadata } from "next";

// Invite links are private, tokenized URLs. Never index them.
export const metadata: Metadata = {
  title: "Team invite",
  robots: { index: false, follow: false },
};

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
