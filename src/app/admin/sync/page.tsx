import type { Metadata } from "next";
import { readSyncStatus } from "@/lib/sync-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sync Operations", robots: { index: false, follow: false } };

export default function SyncOperations() {
  const { report, deployment, stale, workflows } = readSyncStatus();
  return <main className="mx-auto max-w-5xl px-5 py-14">
    <p className="label text-muted">PLUGINWORLD · SYNC OPERATIONS</p>
    <h1 className="mt-3 text-4xl font-bold">Discover. Review. Publish.</h1>
    <p className="mt-4 text-muted">Daily discovery across GitHub, npm, the official MCP Registry and skills.sh. New candidates are reviewed before publishing.</p>
    <div className="mt-8 rounded-[12px] border border-line bg-white p-6">
      <p className="font-mono">{deployment?.state === "failed" ? "ATTENTION · last deployment failed; previous release remains active" : stale ? "ATTENTION · snapshot over 36 hours old or unavailable" : "CURRENT · latest snapshot published"}</p>
      <p className="mt-3 text-sm text-muted">Schedule: {report?.schedule ?? "Daily 02:00 UTC (10:00 Asia/Singapore)"}</p>
      <p className="mt-2 text-sm text-muted">Last successful review: {report?.generatedAt ?? "Not yet available"}</p>
      {deployment && <p className="mt-2 break-all font-mono text-xs">Deployment: {deployment.state} · {deployment.commit} · {deployment.updatedAt}</p>}
      <a className="mt-5 inline-block rounded-[8px] bg-volt px-4 py-2 text-sm text-ink" href={workflows} target="_blank" rel="noopener noreferrer">Open runs &amp; manual controls on GitHub →</a>
    </div>
    {report && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">{[
        ["INDEXED",report.indexed], ["NEW THIS RUN",report.newlyIndexed], ["SKILLS REVIEWED",report.reviewedSkills], ["QUARANTINED",report.quarantined],
      ].map(([label,value])=><div key={label} className="rounded-[12px] border border-line bg-white p-5"><p className="label text-muted">{label}</p><p className="mt-3 font-mono text-3xl">{value}</p></div>)}</div>
      <h2 className="mt-10 text-xl font-bold">Source coverage</h2>
      {report.registryUpdatedSince && <p className="mt-3 text-sm text-muted">Official MCP Registry changes since {report.registryUpdatedSince}, with a 48-hour overlap from the preceding snapshot.</p>}
      <table className="mt-4 w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-3">Source</th><th>Candidates</th><th>Result</th></tr></thead><tbody>{Object.entries(report.sourceCounts).map(([name,count])=><tr key={name} className="border-b border-line"><td className="py-3">{name}</td><td className="font-mono">{count}</td><td>{count > 0 ? "Fetched" : "Unavailable / no results"}</td></tr>)}</tbody></table>
      <h2 className="mt-10 text-xl font-bold">Skills review decisions</h2>
      <div className="mt-4 flex flex-wrap gap-3">{Object.entries(report.skillsDecisions).map(([key,count])=><span key={key} className="rounded-[8px] border border-line bg-white px-4 py-3 font-mono text-sm">{key}: {count}</span>)}</div>
      <p className="mt-5 text-sm leading-relaxed text-muted">{report.auditScope}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">Critical findings are quarantined. Skills without documents appear as metadata-only profiles with no installation commands; their content remains unreviewed. Other warnings remain visible on detail pages. Failed required-source fetches stop publication and preserve the last good release.</p>
    </>}
    <p className="mt-10 text-xs text-faint">This page shows public catalog health only. Starting workflows requires repository write access on GitHub. Scan and deployment failures are recorded in GitHub Actions; the snapshot timestamp identifies stale data.</p>
  </main>;
}
