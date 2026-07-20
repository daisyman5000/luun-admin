import { ForecastingGlobe } from "@/components/forecasting-globe";
import { requireUser } from "@/lib/auth";

export default async function ForecastingPage() {
  await requireUser();

  return (
    <main className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-normal">Forecasting</h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Track containers, warehouse stock, and factory batches by location. Select a location to
          review the SKU list.
        </p>
      </div>
      <ForecastingGlobe />
    </main>
  );
}
