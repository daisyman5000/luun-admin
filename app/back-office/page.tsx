import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { localContentEnabled } from "@/lib/local-content";
import { backOfficeLinks } from "@/lib/operator-navigation";
export default async function BackOffice() {
 if (!localContentEnabled((await headers()).get("host"))) await requireUser();
 return <main className="mx-auto max-w-4xl p-6 sm:p-10"><p className="text-xs uppercase tracking-widest text-slate-400">Records & configuration</p><h1 className="mt-3 text-3xl font-semibold">Back office</h1><p className="mt-3 text-slate-500">Open the underlying records when you need to check or correct something.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{backOfficeLinks.map(link=><Link href={link.href} key={link.href} className="rounded-2xl border border-line bg-white p-6"><h2 className="font-semibold">{link.label}</h2><p className="mt-2 text-sm text-slate-500">{link.detail}</p></Link>)}</div></main>;
}
