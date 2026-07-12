import { CustomMarketplace } from "@/components/CustomMarketplace";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="max-w-2xl text-black/70 dark:text-white/70">
          The custom marketplace. Each card lists your instances of that
          integration — add another, open one to configure it, or view them all.
        </p>
      </section>
      <CustomMarketplace />
    </div>
  );
}
