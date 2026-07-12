import { IntegrationDetail } from "@/components/IntegrationDetail";

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ integrationId: string }>;
}) {
  const { integrationId } = await params;
  return (
    <IntegrationDetail integrationId={decodeURIComponent(integrationId)} />
  );
}
