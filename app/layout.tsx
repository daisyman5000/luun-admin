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
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          {user ? (
            <header className="border-b border-line bg-white">
              <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
                <Link href="/data" className="text-lg font-semibold tracking-normal">
                  Luun Admin
                </Link>
                <nav className="flex items-center gap-2 text-sm">
                  {protectedLinks.map((link) => (
                    <Link
                      className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
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
