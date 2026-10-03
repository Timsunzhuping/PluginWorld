import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:3000";
async function get(path) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(30000), headers: { "Cache-Control":"no-cache" } });
  assert.equal(r.status,200,path); return r;
}
const status=await (await get('/api/v1/sync-status')).json();
assert.equal(status.report?.reviewedSkills,1000);
assert.equal(status.report?.requestedSkills,1000);
assert.equal(status.stale,false);
for (const eco of ['dsh','claude-code','mcp','skills']) {
  const d=await (await get(`/api/v1/plugins?ecosystem=${eco}&per_page=1`)).json();
  assert.ok(d.total>0); assert.equal(d.items[0].ecosystem,eco);
  if (eco==='skills') assert.ok(d.total >= (status.report.skillsDecisions.approved || 0) + (status.report.skillsDecisions['published-with-notes'] || 0) + (status.report.skillsDecisions['metadata-only'] || 0));
  console.log(eco,d.total);
}
const query=await (await get('/api/v1/plugins?ecosystem=skills&q=tdd')).json();
assert.ok(query.items.some(p=>p.slug==='skills/mattpocock/tdd'));
const detail=await (await get('/api/v1/plugins/skills/mattpocock/tdd?include=readme')).json();
assert.ok(detail.readme_html?.length>50);assert.ok(detail.install.some(i=>i.command.includes('--skill tdd')));
for(const path of ['/','/browse?ecosystem=skills','/admin/sync','/plugins/skills/mattpocock/tdd','/sitemap.xml'])await get(path);
console.log('Production acceptance passed',JSON.stringify(status.deployment));
