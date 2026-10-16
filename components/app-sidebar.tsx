"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { operatorLinks } from "@/lib/operator-navigation";
export function AppSidebar({ signedIn = false }: { signedIn?: boolean }) {
 const path = usePathname();
 return <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-white p-5 lg:flex lg:flex-col">
  <Link href="/content" className="mb-12 text-xl font-semibold tracking-tight">LUUN<span className="ml-2 text-xs font-normal text-slate-400">Workspace</span></Link>
  <nav aria-label="Primary" className="space-y-2">{operatorLinks.map(link=><Link aria-current={path.startsWith(link.href)?"page":undefined} className={"block rounded-xl px-4 py-3 text-sm font-medium "+(path.startsWith(link.href)?"bg-slate-950 text-white":"text-slate-600 hover:bg-slate-50")} href={link.href} key={link.href}>{link.label}</Link>)}</nav>
  <div className="mt-auto"><Link href="/back-office" className="block rounded-xl px-4 py-3 text-sm text-slate-500">Back office / Settings</Link>{signedIn ? <div className="px-4 pt-2"><LogoutButton /></div> : null}</div>
 </aside>;
}
