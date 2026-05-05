/**
 * OpenCodeAdapter — shape type for the OpenCode provider adapter.
 *
 * Historically this module exposed a `Context.Service` tag so consumers
 * could inject the adapter through the Effect layer graph. The driver
 * model ({@link ../Drivers/OpenCodeDriver}) bundles one adapter per
 * instance as a captured closure instead, so the tag is gone — we only
 * retain the shape interface as a naming anchor for the driver bundle.
 *
 * @module OpenCodeAdapter
 */
import { Context } from "effect";
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * OpenCodeAdapterShape — per-instance OpenCode adapter contract. Carries
 * a branded driver kind as the nominal discriminant.
 */
export interface OpenCodeAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}

/**
 * Compatibility service tag retained for the legacy `OpenCodeAdapterLive`
 * layer and its tests. New runtime code should prefer `makeOpenCodeAdapter`.
 */
export class OpenCodeAdapter extends Context.Service<OpenCodeAdapter, OpenCodeAdapterShape>()(
  "t3/provider/Services/OpenCodeAdapter",
) {}
