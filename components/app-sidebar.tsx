"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const primaryLinks = [
  { href: "/", label: "Home", short: "H" },
  { href: "/data", label: "Orders", short: "O" },
  { href: "/inventory", label: "Inventory", short: "I" },
  { href: "/demand", label: "Demand Plan", short: "D" },
  { href: "/cac", label: "CAC", short: "CAC" },
  { href: "/jobs", label: "Jobs", short: "J" },
  { href: "/ticketing", label: "Ticketing", short: "T", soon: true },
  { href: "/forecasting/containers", label: "Invoices", short: "In" }
];

const adminLinks = [{ href: "/settings/users", label: "Users", short: "U" }];

function SidebarLink({
  exact,
  href,
  label,
  short,
  soon
}: {
  exact?: boolean;
  href: string;
  label: string;
  short: string;
  soon?: boolean;
}) {
  const pathname = usePathname();
  const isActive = href === "/" || exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      className={[
        "group flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium",
        isActive
          ? "border-blue-200 bg-blue-50 text-slate-900 shadow-sm"
          : "border-transparent text-slate-700 hover:border-line hover:bg-white/70"
      ].join(" ")}
      href={href}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
          isActive ? "bg-ink text-white" : "bg-white/80 text-slate-600 group-hover:bg-blue-50"
        ].join(" ")}
      >
        {short}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {soon ? (
        <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-500">
          Later
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/60 bg-white/65 p-4 shadow-sm backdrop-blur-xl lg:flex lg:flex-col">
      <Link className="mb-6 flex items-center gap-3 rounded-xl px-2 py-2" href="/">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-lg font-bold text-white shadow-sm">
          L
        </span>
        <span>
          <span className="block text-base font-semibold text-slate-900">Luun Admin</span>
          <span className="block text-xs font-medium text-slate-500">Logistics portal</span>
        </span>
      </Link>

      <nav className="space-y-1">
        {primaryLinks.map((link) => (
          <SidebarLink key={link.href} {...link} />
        ))}
      </nav>

      <div className="mt-6 border-t border-line pt-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          Admin
        </p>
        <nav className="space-y-1">
          {adminLinks.map((link) => (
            <SidebarLink key={link.href} {...link} />
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-xl border border-white/70 bg-white/70 p-3">
        <p className="mb-3 text-xs font-medium text-slate-500">Signed in to Luun Admin</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
