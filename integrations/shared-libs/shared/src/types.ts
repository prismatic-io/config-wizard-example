/**
 * Base contract for the config-wizard pattern (category selection → per-category delivery rules).
 *
 * `buildConfigForm` consumes a list of `CategoryModule`s — each a notification category plus its
 * delivery-field spec — supplied by the `ACME_CATEGORIES` catalog in `categories.ts`. The integration
 * also passes a platform-specific `ChannelAdapter`. The builder shape stays identical so the custom
 * config wizard renders every messaging integration the same way.
 */

/** One notification category the customer can enable (e.g. "Deployments"). */
export interface NotificationCategory {
  /** Stable key — also the top-level property key in the emitted schema. */
  key: string;
  label: string;
  description?: string;
}

/** Ordered list of categories. Accepts `as const` catalogs (readonly tuples). */
export type CategoryCatalog = readonly NotificationCategory[];

/** A single choice in a delivery field. `value` is the payload value; `label` is what the user sees. */
export interface DeliveryOption {
  label: string;
  value: string;
}

/**
 * A single delivery-rule field — the source of truth shared by the category's component (which builds its
 * spectral `input()` from this) and the wizard (which renders a control from it). Multi-select arrays
 * render as a picklist; single-select renders as a dropdown; a single field with no options renders as a
 * free-text input (used for the quiet-hours times).
 */
export interface DeliveryFieldSpec {
  /** Stable key — the input key in the component and the property key in the emitted delivery group. */
  key: string;
  label: string;
  /** Multi-select (array) vs single value (string). */
  multi: boolean;
  /** Mandatory field. */
  required?: boolean;
  /** Default value for single fields (e.g. mode → "Real-time"). */
  default?: string;
  /** Choices. Empty + single ⇒ free-text input; empty + multi ⇒ free-text multi-select. */
  options: DeliveryOption[];
}

/**
 * A category's full contribution to a messaging integration: its catalog entry plus the delivery-rule
 * field spec. Exported by each per-category lib and assembled by the integration. `channels` is injected
 * separately by `buildConfigForm` from the platform `ChannelAdapter`, so it is not part of `delivery`.
 */
export interface CategoryModule {
  category: NotificationCategory;
  delivery: DeliveryFieldSpec[];
}

/** A {key,label} option pair (matches the picklist option shape the wizard renders for channels). */
export interface ChannelOption {
  key: string;
  label: string;
}

/**
 * Platform-specific channel info injected by each integration. The channel options are fetched by the
 * integration (using its active connection) and baked into the emitted form; the title/icon drive the
 * de-branded channel picker in the wizard.
 */
export interface ChannelAdapter {
  /** Label for the channel multi-select, e.g. "Send to Slack channel" / "Send to Teams channel". */
  channelTitle: string;
  /** Icon hint the wizard maps to a lucide icon (e.g. "hash"). Optional → wizard default. */
  channelIcon?: string;
  /** Channel destinations fetched by the integration (key = id, label = display name). */
  channelOptions: ChannelOption[];
}
