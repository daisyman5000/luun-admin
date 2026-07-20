import Link from "next/link";
import { requireUser } from "@/lib/auth";

const homeCards = [
  {
    href: "/data",
    label: "Orders",
    description: "View Shopify orders and update delivery follow-up."
  },
  {
    href: "/inventory",
    label: "Inventory",
    description: "Update available quantity by fabric and module."
  },
  {
    href: "/ticketing",
    label: "Ticketing",
    description: "Planned workspace for internal issue follow-up."
  },
  {
    href: "/forecasting",
    label: "Forecasting",
    description: "Planned view for inventory and demand planning."
  },
  {
    href: "/financials",
    label: "Financials",
    description: "Planned view for order and logistics finance."
  }
];

export default async function HomePage() {
  await requireUser();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 max-w-4xl">
        <p className="mb-2 text-sm font-semibold text-blue-700">Luun Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Home</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Start with orders or inventory. The other sections are set up in the navigation so the
          portal has the right shape before those tools are built.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {homeCards.map((card) => (
          <Link
            className="rounded-xl border border-line bg-white p-5 shadow-sm hover:border-blue-200 hover:bg-blue-50"
            href={card.href}
            key={card.href}
          >
            <span className="text-lg font-semibold text-slate-900">{card.label}</span>
            <span className="mt-2 block text-sm leading-6 text-slate-600">{card.description}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
