import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luun Admin",
  description: "Private Luun logistics admin portal"
};

const protectedLinks = [
  { href: "/data", label: "Orders" },
  { href: "/inventory", label: "Inventory" },
  { href: "/settings/users", label: "Users" }
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  let user = null;

  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser }
    } = await supabase.auth.getUser();
    user = currentUser;
  } catch {
    user = null;
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          {user ? (
            <header className="sticky top-0 z-30 border-b border-line bg-white shadow-sm">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <Link href="/data" className="flex items-center gap-3 text-lg font-semibold tracking-normal">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-base font-bold text-white">
                    L
                  </span>
                  <span>Luun Admin</span>
                </Link>
                <nav className="flex flex-wrap items-center gap-2 text-sm">
                  {protectedLinks.map((link) => (
                    <Link
                      className="rounded-md border border-transparent px-4 py-2.5 font-medium text-slate-700 hover:border-line hover:bg-slate-100"
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <LogoutButton />
                </nav>
              </div>
            </header>
          ) : null}
          {children}
        </div>
      </body>
    </html>
  );
}
