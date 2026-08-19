import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl text-neutral-900">Acme Integrations demo</h1>
        <p className="max-w-2xl text-black/70">
          A barebones Next.js app that embeds Prismatic. It signs a short-lived JWT
          on the server, authenticates the embedded SDK in the browser, and (in the
          next stages) renders a fully custom marketplace and launches the Prismatic
          config wizard.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">SDK status</h2>
        <AuthStatus />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What&apos;s wired up</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-black/70">
          <li>
            <code>app/api/integration-token/route.ts</code> — server-only RS256 JWT
            signing (hardcoded demo customer from env).
          </li>
          <li>
            <code>hooks/usePrismaticAuth.ts</code> — initializes the SDK,
            authenticates, and re-authenticates before token expiry.
          </li>
          <li>
            <code>lib/marketplace.ts</code> + <code>components/*</code> — custom
            marketplace cards from <code>graphqlRequest</code>, launching a fully
            custom in-app config wizard (<code>useConfigWizard</code>).
          </li>
          <li>
            <Link href="/integrations" className="underline">
              /integrations
            </Link>{" "}
            — the custom marketplace.
          </li>
        </ul>
      </section>
    </div>
  );
}
