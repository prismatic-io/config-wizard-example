export interface AcmeTeamsMessage {
  /** Category label (e.g. "Deployments") — derived from the catalog at runtime. */
  category: string;
  title: string;
  summary: string;
  link?: string;
}

/**
 * Formats an Acme event as a plain-text Teams-style message. In a real integration this would be
 * an Adaptive Card posted via the Microsoft Teams component; here the flows just log the returned
 * string, so we keep it human-readable.
 */
export function formatAcmeTeamsMessage(msg: AcmeTeamsMessage): string {
  const linkSuffix = msg.link ? ` (View in Acme: ${msg.link})` : "";
  return `🚨 Acme ${msg.category}: ${msg.title} — ${msg.summary}${linkSuffix}`;
}
