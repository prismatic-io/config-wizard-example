import { ConfigWizard } from "@/components/example/ConfigWizard";

export default async function ConfigureInstancePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  return <ConfigWizard instanceId={decodeURIComponent(instanceId)} />;
}
