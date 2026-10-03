/** Manual repair of recent source discovery; the regular pipeline still performs all review gates. */
import fs from "node:fs";
import { resolveSkills, parseSkillDocument, type ResolvedSkill } from "./skills-sh";
async function main() {
  const file = ".cache/discovery-skills-1000.json";
  const cache = JSON.parse(fs.readFileSync(file,"utf8"));
  if (Date.now()-cache.at>15*60*1000) throw new Error("Discovery is stale: perform a fresh scan");
  const missing:ResolvedSkill[]=cache.value.skills.filter((s:ResolvedSkill)=>!s.body);
  const docFolder=process.argv[2];
  const preloaded:ResolvedSkill[]=[];
  if (docFolder) {
    for (const skill of missing) {
      if (!["agent.qq.com","skills.volces.com"].includes(skill.source)) continue;
      const file=`${docFolder}/pluginworld-${skill.skillId}.md`;
      if (!fs.existsSync(file)) continue;
      const parsed=parseSkillDocument(fs.readFileSync(file,"utf8"));
      if (!parsed) continue;
      preloaded.push({...skill,...parsed,skillMdPath:`.well-known/skills/${skill.skillId}/SKILL.md`});
    }
  }
  const preloadedRanks=new Set(preloaded.map(s=>s.rank));
  const retried=[...preloaded,...await resolveSkills(missing.filter(s=>!preloadedRanks.has(s.rank)))];
  const byRank=new Map(retried.map(s=>[s.rank,s]));
  cache.value.skills=cache.value.skills.map((s:ResolvedSkill)=>byRank.get(s.rank)??s);
  fs.writeFileSync(file,JSON.stringify(cache),{mode:0o600});
  console.log("Retried",missing.length,"resolved",retried.filter(s=>s.body).length,"still pending",retried.filter(s=>!s.body).map(s=>`${s.source}/${s.skillId}`));
}
main().catch(e=>{console.error(e);process.exitCode=1});
