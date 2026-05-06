import {
  type GitHubCopilotSettings,
  type ModelCapabilities,
  ProviderDriverKind,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelCapabilities } from "@t3tools/shared/model";
import { Cause, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpSchema from "effect-acp/schema";

import { makeGitHubCopilotAcpRuntime } from "../acp/GitHubCopilotAcpSupport.ts";
import {
  buildServerProvider,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
  type ServerProviderDraft,
} from "../providerSnapshot.ts";

const PROVIDER = ProviderDriverKind.make("githubCopilot");
const PRESENTATION = {
  displayName: "GitHub Copilot",
  badgeLabel: "Preview",
  showInteractionModeToggle: true,
} as const;
const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});
const ACP_PROBE_TIMEOUT = "10 seconds";

export function makePendingGitHubCopilotProvider(
  settings: GitHubCopilotSettings,
): ServerProviderDraft {
  const checkedAt = new Date().toISOString();
  const models = getGitHubCopilotFallbackModels(settings);

  if (!settings.enabled) {
    return buildServerProvider({
      presentation: PRESENTATION,
      enabled: false,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "GitHub Copilot is disabled in Vaia Code settings.",
      },
    });
  }

  return buildServerProvider({
    presentation: PRESENTATION,
    enabled: true,
    checkedAt,
    models,
    probe: {
      installed: true,
      version: null,
      status: "warning",
      auth: { status: "unknown" },
      message: "Checking GitHub Copilot CLI availability...",
    },
  });
}

function flattenSessionConfigSelectOptions(
  configOption: EffectAcpSchema.SessionConfigOption | undefined,
): ReadonlyArray<{ readonly value: string; readonly name: string }> {
  if (!configOption || configOption.type !== "select") {
    return [];
  }
  return configOption.options.flatMap((entry) =>
    "value" in entry
      ? [{ value: entry.value.trim(), name: entry.name.trim() }]
      : entry.options.map((option) => ({
          value: option.value.trim(),
          name: option.name.trim(),
        })),
  );
}

function findModelConfigOption(
  configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption>,
): EffectAcpSchema.SessionConfigOption | undefined {
  return configOptions.find((option) => option.category === "model" || option.id === "model");
}

export function buildGitHubCopilotDiscoveredModelsFromConfigOptions(
  configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption> | null | undefined,
): ReadonlyArray<ServerProviderModel> {
  if (!configOptions || configOptions.length === 0) {
    return [];
  }

  const modelOption = findModelConfigOption(configOptions);
  const choices = flattenSessionConfigSelectOptions(modelOption);
  const seen = new Set<string>();
  return choices.flatMap((choice) => {
    const slug = choice.value.trim();
    if (!slug || seen.has(slug)) {
      return [];
    }
    seen.add(slug);
    return [
      {
        slug,
        name: choice.name || slug,
        isCustom: false,
        capabilities: EMPTY_CAPABILITIES,
      } satisfies ServerProviderModel,
    ];
  });
}

export function getGitHubCopilotFallbackModels(
  settings: Pick<GitHubCopilotSettings, "customModels">,
): ReadonlyArray<ServerProviderModel> {
  return providerModelsFromSettings(
    [{ slug: "default", name: "Default", isCustom: false, capabilities: EMPTY_CAPABILITIES }],
    PROVIDER,
    settings.customModels,
    EMPTY_CAPABILITIES,
  );
}

function isAuthenticationFailure(cause: Cause.Cause<unknown>): boolean {
  const pretty = Cause.pretty(cause).toLowerCase();
  return (
    pretty.includes("auth") ||
    pretty.includes("login") ||
    pretty.includes("token") ||
    pretty.includes("credential")
  );
}

const discoverModelsViaAcp = (
  settings: GitHubCopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const runtime = yield* makeGitHubCopilotAcpRuntime({
      copilotSettings: settings,
      environment,
      childProcessSpawner: spawner,
      cwd: process.cwd(),
      clientInfo: { name: "t3-code-provider-probe", version: "0.0.0" },
    });
    const started = yield* runtime.start();
    return buildGitHubCopilotDiscoveredModelsFromConfigOptions(
      started.sessionSetupResult.configOptions ?? [],
    );
  }).pipe(Effect.scoped);

export const checkGitHubCopilotProviderStatus = Effect.fn(
  "checkGitHubCopilotProviderStatus",
)(function* (
  settings: GitHubCopilotSettings,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const checkedAt = new Date().toISOString();
  if (!settings.enabled) {
    return makePendingGitHubCopilotProvider(settings);
  }

  const versionResult = yield* spawnAndCollect(
    settings.binaryPath,
    ChildProcess.make(settings.binaryPath, ["version"], { env: environment }),
  ).pipe(
    Effect.timeout("4 seconds"),
    Effect.exit,
  );

  if (versionResult._tag === "Failure") {
    const cause = Cause.squash(versionResult.cause);
    const message = cause instanceof Error ? cause.message : String(cause);
    return buildServerProvider({
      presentation: PRESENTATION,
      enabled: true,
      checkedAt,
      models: getGitHubCopilotFallbackModels(settings),
      probe: {
        installed: false,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message: isCommandMissingCause(new Error(message))
          ? "GitHub Copilot CLI is not installed. Install it with `npm install -g @github/copilot` or `brew install copilot-cli`."
          : message,
      },
    });
  }

  if (versionResult.value.code !== 0) {
    return buildServerProvider({
      presentation: PRESENTATION,
      enabled: true,
      checkedAt,
      models: getGitHubCopilotFallbackModels(settings),
      probe: {
        installed: true,
        version: null,
        status: "error",
        auth: { status: "unknown" },
        message:
          versionResult.value.stderr.trim() ||
          versionResult.value.stdout.trim() ||
          `GitHub Copilot CLI exited with code ${versionResult.value.code}.`,
      },
    });
  }

  const versionOutput = versionResult.value.stdout || versionResult.value.stderr;
  const version = parseGenericCliVersion(versionOutput) ?? (versionOutput.trim() || null);
  const acpDiscovery = yield* discoverModelsViaAcp(settings, environment).pipe(
    Effect.timeout(ACP_PROBE_TIMEOUT),
    Effect.exit,
  );

  if (acpDiscovery._tag === "Failure") {
    const authFailed = isAuthenticationFailure(acpDiscovery.cause);
    return buildServerProvider({
      presentation: PRESENTATION,
      enabled: true,
      checkedAt,
      models: getGitHubCopilotFallbackModels(settings),
      probe: {
        installed: true,
        version,
        status: authFailed ? "warning" : "warning",
        auth: authFailed ? { status: "unauthenticated" } : { status: "unknown" },
        message: authFailed
          ? "GitHub Copilot CLI is not authenticated. Run `copilot login` or configure COPILOT_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN in the provider environment."
          : `Could not verify GitHub Copilot ACP status: ${Cause.pretty(acpDiscovery.cause)}`,
      },
    });
  }

  const discoveredModels = acpDiscovery.value;
  return buildServerProvider({
    presentation: PRESENTATION,
    enabled: true,
    checkedAt,
    models: providerModelsFromSettings(
      discoveredModels.length > 0 ? discoveredModels : getGitHubCopilotFallbackModels(settings),
      PROVIDER,
      settings.customModels,
      EMPTY_CAPABILITIES,
    ),
    probe: {
      installed: true,
      version,
      status: "ready",
      auth: { status: "authenticated" },
    },
  });
});
