import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createLoggedTool, type RegisteredTool } from "./registry.js";
import { runReadOnlyCommand } from "./shell.js";

const repoSchema = z.object({
  repo: z.string().describe("GitHub repository in owner/name format"),
});

export function createGithubTools(
  _config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    github_actions_status: createLoggedTool({
      name: "github_actions_status",
      description: "Read recent GitHub Actions runs for a repository using gh CLI.",
      inputSchema: repoSchema,
      risk: "read",
      db,
      execute: async ({ repo }) => {
        const { stdout } = await runReadOnlyCommand("gh", [
          "run",
          "list",
          "--repo",
          repo,
          "--limit",
          "5",
          "--json",
          "databaseId,displayTitle,event,headBranch,status,conclusion,createdAt,updatedAt,url",
        ]);
        return JSON.parse(stdout || "[]") as unknown;
      },
    }),
    github_prs: createLoggedTool({
      name: "github_prs",
      description: "Read open pull requests for a repository using gh CLI.",
      inputSchema: repoSchema,
      risk: "read",
      db,
      execute: async ({ repo }) => {
        const { stdout } = await runReadOnlyCommand("gh", [
          "pr",
          "list",
          "--repo",
          repo,
          "--state",
          "open",
          "--json",
          "number,title,author,headRefName,updatedAt,url",
        ]);
        return JSON.parse(stdout || "[]") as unknown;
      },
    }),
    github_issues: createLoggedTool({
      name: "github_issues",
      description: "Read open issues for a repository using gh CLI.",
      inputSchema: repoSchema,
      risk: "read",
      db,
      execute: async ({ repo }) => {
        const { stdout } = await runReadOnlyCommand("gh", [
          "issue",
          "list",
          "--repo",
          repo,
          "--state",
          "open",
          "--json",
          "number,title,author,updatedAt,url,labels",
        ]);
        return JSON.parse(stdout || "[]") as unknown;
      },
    }),
  };
}
