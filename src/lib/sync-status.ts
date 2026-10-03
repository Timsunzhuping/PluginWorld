import "server-only";
import fs from "node:fs";
import path from "node:path";

export interface SyncReport {
  generatedAt: string;
  status: string;
  schedule: string;
  sourceCounts: Record<string, number>;
  registryUpdatedSince?: string | null;
  inactiveRegistryEntries?: number;
  requestedSkills: number;
  reviewedSkills: number;
  skillsDecisions: Record<string, number>;
  indexed: number;
  newlyIndexed: number;
  retained: number;
  quarantined: number;
  durationSeconds: number;
  auditScope: string;
}
export function readSyncStatus() {
  const file = path.join(process.cwd(), "src/data/seed/sync-report.json");
  const report: SyncReport | null = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  let deployment: { state: string; commit: string; updatedAt: string } | null = null;
  const statusFile = process.env.PLUGINWORLD_DEPLOY_STATUS_FILE;
  if (statusFile && fs.existsSync(statusFile)) {
    try {
      const d = JSON.parse(fs.readFileSync(statusFile, "utf8"));
      deployment = { state: String(d.state), commit: String(d.commit), updatedAt: String(d.updatedAt) };
    } catch { /* Atomic writes normally prevent this; keep the dashboard available. */ }
  }
  return {
    report, deployment,
    stale: !report || Date.now() - new Date(report.generatedAt).getTime() > 36 * 60 * 60 * 1000,
    workflows: "https://github.com/ApollaAI/PluginWorld/actions",
  };
}
