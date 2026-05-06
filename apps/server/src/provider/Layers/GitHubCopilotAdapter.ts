import {
  type GitHubCopilotSettings,
  ProviderDriverKind,
  ProviderInstanceId,
} from "@t3tools/contracts";

import {
  applyGitHubCopilotAcpModelSelection,
  makeGitHubCopilotAcpRuntime,
} from "../acp/GitHubCopilotAcpSupport.ts";
import { makeCursorAdapter } from "./CursorAdapter.ts";
import { type EventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = ProviderDriverKind.make("githubCopilot");

export interface GitHubCopilotAdapterLiveOptions {
  readonly instanceId?: ProviderInstanceId;
  readonly environment?: NodeJS.ProcessEnv;
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
}

export function makeGitHubCopilotAdapter(
  copilotSettings: GitHubCopilotSettings,
  options?: GitHubCopilotAdapterLiveOptions,
) {
  return makeCursorAdapter(
    {
      enabled: copilotSettings.enabled,
      binaryPath: copilotSettings.binaryPath,
      apiEndpoint: "",
      customModels: copilotSettings.customModels,
    },
    {
      provider: PROVIDER,
      instanceId: options?.instanceId ?? ProviderInstanceId.make("githubCopilot"),
      enableCursorExtensions: false,
      ...(options?.environment ? { environment: options.environment } : {}),
      ...(options?.nativeEventLogPath ? { nativeEventLogPath: options.nativeEventLogPath } : {}),
      ...(options?.nativeEventLogger ? { nativeEventLogger: options.nativeEventLogger } : {}),
      makeRuntime: (input) =>
        makeGitHubCopilotAcpRuntime({
          copilotSettings,
          childProcessSpawner: input.childProcessSpawner,
          cwd: input.cwd,
          clientInfo: input.clientInfo,
          ...(input.resumeSessionId ? { resumeSessionId: input.resumeSessionId } : {}),
          ...(input.requestLogger ? { requestLogger: input.requestLogger } : {}),
          ...(options?.environment ? { environment: options.environment } : {}),
        }),
      applyModelSelection: ({ runtime, model, mapError }) =>
        applyGitHubCopilotAcpModelSelection({
          runtime,
          model,
          mapError: ({ cause }) =>
            mapError({
              cause,
              method: "session/set_config_option",
            }),
        }),
    },
  );
}
