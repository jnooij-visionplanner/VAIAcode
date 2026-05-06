import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  applyGitHubCopilotAcpModelSelection,
  buildGitHubCopilotAcpSpawnInput,
  makeGitHubCopilotEnvironment,
} from "./GitHubCopilotAcpSupport.ts";

describe("buildGitHubCopilotAcpSpawnInput", () => {
  it("builds the default Copilot ACP stdio command", () => {
    expect(buildGitHubCopilotAcpSpawnInput(undefined, "/tmp/project")).toEqual({
      command: "copilot",
      args: ["--acp", "--stdio"],
      cwd: "/tmp/project",
    });
  });

  it("includes launch args after the ACP stdio flags", () => {
    expect(
      buildGitHubCopilotAcpSpawnInput(
        {
          binaryPath: "/opt/bin/copilot",
          homePath: "",
          githubHost: "",
          launchArgs: "--debug --log-level trace",
        },
        "/tmp/project",
      ),
    ).toEqual({
      command: "/opt/bin/copilot",
      args: ["--acp", "--stdio", "--debug", "--log-level", "trace"],
      cwd: "/tmp/project",
    });
  });
});

describe("makeGitHubCopilotEnvironment", () => {
  it("maps provider settings into Copilot-specific environment variables", () => {
    expect(
      makeGitHubCopilotEnvironment(
        {
          binaryPath: "copilot",
          homePath: "/tmp/copilot-home",
          githubHost: "https://github.example.com",
          launchArgs: "",
        },
        { PATH: "/usr/bin" },
      ),
    ).toEqual({
      PATH: "/usr/bin",
      COPILOT_HOME: "/tmp/copilot-home",
      COPILOT_GH_HOST: "https://github.example.com",
    });
  });
});

describe("applyGitHubCopilotAcpModelSelection", () => {
  it("does not call setModel for the default sentinel", async () => {
    const calls: Array<string> = [];

    await Effect.runPromise(
      applyGitHubCopilotAcpModelSelection({
        runtime: {
          setModel: (model) =>
            Effect.sync(() => {
              calls.push(model);
            }),
        },
        model: "default",
        mapError: ({ cause }) => new Error(cause.message),
      }),
    );

    expect(calls).toEqual([]);
  });

  it("sets explicit model slugs", async () => {
    const calls: Array<string> = [];

    await Effect.runPromise(
      applyGitHubCopilotAcpModelSelection({
        runtime: {
          setModel: (model) =>
            Effect.sync(() => {
              calls.push(model);
            }),
        },
        model: "gpt-5-preview",
        mapError: ({ cause }) => new Error(cause.message),
      }),
    );

    expect(calls).toEqual(["gpt-5-preview"]);
  });
});
