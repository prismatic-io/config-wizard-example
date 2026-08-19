import { ChevronDown } from "lucide-react";
import { CustomMarketplace } from "@/components/CustomMarketplace";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Acme Integrations</h1>
        <p className="max-w-2xl text-sm text-neutral-500">
          Link accounts and keep customer data in sync with the tools your team uses
          every day.
        </p>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">Workspace</span>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-900"
          >
            Globex Inc
            <ChevronDown size={14} className="text-neutral-400" />
          </button>
        </div>
        <p className="text-sm text-neutral-400">
          New links are named after the selected workspace.
        </p>
      </section>

      <CustomMarketplace />
    </div>
  );
}
