import { CustomMarketplace } from "@/components/CustomMarketplace";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="max-w-2xl text-black/70 dark:text-white/70">
          The custom marketplace. Integration cards (Stage 2) will be queried from
          Prismatic via GraphQL and rendered here, with a &ldquo;Connect&rdquo;
          action that opens the config wizard (Stage 3).
        </p>
      </section>
      <CustomMarketplace />
    </div>
  );
}
