import Link from "next/link";

export function InventoryTabs({ active }: { active: "manage" | "on-hand" }) {
  const tabs = [
    { href: "/inventory", label: "Manage inventory", value: "manage" },
    { href: "/inventory/on-hand", label: "On hand", value: "on-hand" }
  ] as const;

  return (
    <div className="mb-5 flex gap-2 border-b border-line">
      {tabs.map((tab) => (
        <Link
          className={[
            "border-b-2 px-3 py-2 text-sm font-medium",
            active === tab.value
              ? "border-sky-300 text-sky-200"
              : "border-transparent text-slate-600 hover:text-slate-900"
          ].join(" ")}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
