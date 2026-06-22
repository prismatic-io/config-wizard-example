export interface AcmeSlackMessage {
  /** Category label (e.g. "Deployments") — derived from the catalog at runtime. */
  category: string;
  title: string;
  summary: string;
  link?: string;
}

export function formatAcmeSlackMessage(msg: AcmeSlackMessage): string {
  const linkSuffix = msg.link ? `\n<${msg.link}|View in Acme>` : "";
  return `:rotating_light: *Acme ${msg.category}*: ${msg.title}\n${msg.summary}${linkSuffix}`;
}
