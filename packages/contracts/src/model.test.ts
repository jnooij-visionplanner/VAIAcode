import { describe, expect, it } from "vitest";

import {
  DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER,
  DEFAULT_MODEL_BY_PROVIDER,
} from "./model.ts";
import { ProviderDriverKind } from "./providerInstance.ts";

describe("provider model defaults", () => {
  it("uses the Copilot ACP default model sentinel", () => {
    const driver = ProviderDriverKind.make("githubCopilot");

    expect(DEFAULT_MODEL_BY_PROVIDER[driver]).toBe("default");
    expect(DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER[driver]).toBe("default");
  });
});
