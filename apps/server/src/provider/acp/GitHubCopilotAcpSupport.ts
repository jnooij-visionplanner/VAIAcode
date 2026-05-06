import { parseCliArgs } from "@t3tools/shared/cliArgs";
import { type GitHubCopilotSettings } from "@t3tools/contracts";
import { Effect, Layer, Scope } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpErrors from "effect-acp/errors";

import {
  AcpSessionRuntime,
  type AcpSessionRuntimeOptions,
  type AcpSessionRuntimeShape,
  type AcpSpawnInput,
} from "./AcpSessionRuntime.ts";

type GitHubCopilotAcpSettings = Pick<
  GitHubCopilotSettings,
  "binaryPath" | "githubHost" | "homePath" | "launchArgs"
>;

export interface GitHubCopilotAcpRuntimeInput
  extends Omit<AcpSessionRuntimeOptions, "authMethodId" | "spawn"> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly copilotSettings: GitHubCopilotAcpSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

export interface GitHubCopilotAcpModelSelectionErrorContext {
  readonly cause: EffectAcpErrors.AcpError;
  readonly step: "set-model";
}

export function makeGitHubCopilotEnvironment(
  copilotSettings: GitHubCopilotAcpSettings | null | undefined,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...baseEnv };
  const homePath = copilotSettings?.homePath?.trim();
  const githubHost = copilotSettings?.githubHost?.trim();
  if (homePath) {
    next.COPILOT_HOME = homePath;
  }
  if (githubHost) {
    next.COPILOT_GH_HOST = githubHost;
  }
  return next;
}

export function buildGitHubCopilotAcpSpawnInput(
  copilotSettings: GitHubCopilotAcpSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSpawnInput {
  const parsedLaunchArgs = parseCliArgs(copilotSettings?.launchArgs ?? "");
  const launchArgs = [
    ...Object.entries(parsedLaunchArgs.flags).flatMap(([flag, value]) =>
      value === null ? [`--${flag}`] : [`--${flag}`, value],
    ),
    ...parsedLaunchArgs.positionals,
  ];
  return {
    command: copilotSettings?.binaryPath || "copilot",
    args: ["--acp", "--stdio", ...launchArgs],
    cwd,
    ...(environment ? { env: environment } : {}),
  };
}

export const makeGitHubCopilotAcpRuntime = (
  input: GitHubCopilotAcpRuntimeInput,
): Effect.Effect<AcpSessionRuntimeShape, EffectAcpErrors.AcpError, Scope.Scope> =>
  Effect.gen(function* () {
    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildGitHubCopilotAcpSpawnInput(
          input.copilotSettings,
          input.cwd,
          input.environment,
        ),
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );
    return yield* Effect.service(AcpSessionRuntime).pipe(Effect.provide(acpContext));
  });

interface GitHubCopilotAcpModelSelectionRuntime {
  readonly setModel: (model: string) => Effect.Effect<unknown, EffectAcpErrors.AcpError>;
}

export function applyGitHubCopilotAcpModelSelection<E>(input: {
  readonly runtime: GitHubCopilotAcpModelSelectionRuntime;
  readonly model: string | null | undefined;
  readonly mapError: (context: GitHubCopilotAcpModelSelectionErrorContext) => E;
}): Effect.Effect<void, E> {
  const model = input.model?.trim();
  if (!model || model === "default") {
    return Effect.void;
  }
  return input.runtime.setModel(model).pipe(
    Effect.mapError((cause) =>
      input.mapError({
        cause,
        step: "set-model",
      }),
    ),
    Effect.asVoid,
  );
}
