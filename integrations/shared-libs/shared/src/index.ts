// --- Acme client / connection / gateway ---
export { AcmeClient } from './client';
export type { AcmeClientOptions } from './client';
export { AcmeAPIKeyConnection, connectionInput } from './connection';
export { getGatewayUrl } from './config';
export type { AcmeEnv } from './config';

// --- Delivery-rule evaluation (runtime) ---
export { evaluateDeliveryRules, SEVERITY_ORDER } from './delivery-rules';
export type { NotificationEvent, Severity } from './delivery-rules';

// --- Notification category catalog ---
export {
  ACME_CATEGORIES,
  deploymentsCategory,
  securityCategory,
  billingCategory,
} from './categories';

// --- Config-wizard form builder + base types ---
export { buildConfigForm, parseSelection } from './forms';
export type { CategorySelection, DeliverySelection } from './forms';
export { DELIVERY_FIELDS, DELIVERY_MODES, SEVERITY_LEVELS } from './constants';
export type {
  NotificationCategory,
  CategoryCatalog,
  DeliveryOption,
  DeliveryFieldSpec,
  CategoryModule,
  ChannelOption,
  ChannelAdapter,
} from './types';
