import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luun Admin",
  description: "Private Luun logistics admin portal"
};

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
            <div className="min-h-screen lg:flex">
              <AppSidebar />
              <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 border-b border-line bg-white/85 shadow-sm backdrop-blur-xl lg:hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-normal">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-base font-bold text-white">
                        L
                      </span>
                      <span>Luun Admin</span>
                    </Link>
                    <LogoutButton />
                  </div>
                  <nav className="flex gap-2 overflow-x-auto px-4 pb-3 text-sm">
                    {[
                      { href: "/", label: "Home" },
                      { href: "/data", label: "Orders" },
                      { href: "/inventory", label: "Inventory" },
                      { href: "/demand", label: "Demand Plan" },
                      { href: "/cac", label: "CAC" },
                      { href: "/jobs", label: "Jobs" },
                      { href: "/ticketing", label: "Ticketing" },
                      { href: "/forecasting/containers", label: "Invoices" },
                      { href: "/settings/users", label: "Users" }
                    ].map((link) => (
                      <Link
                        className="shrink-0 rounded-md border border-line bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                        href={link.href}
                        key={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </header>
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </body>
    </html>
  );
}
