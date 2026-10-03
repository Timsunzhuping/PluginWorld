import { describe, expect, it } from "vitest";
import { isGithubSource, parseInitialSkills, parseRenderedSkill, parseSkillDocument } from "../../scripts/sync/skills-sh";
import { installOptions } from "@/lib/install";
import type { Plugin } from "@/lib/types";
import { renderReadme } from "../../scripts/sync/lib";

describe("public skills leaderboard", () => {
  it("keeps well-known providers and correctly decodes brackets inside names", () => {
    const data = [{ source:"open.feishu.cn",skillId:"lark-doc",name:'A [document] "tool"',installs:123,weeklyInstalls:[] }];
    expect(parseInitialSkills('0:'+JSON.stringify({initialSkills:data}))).toEqual(data);
  });
  it("rejects malformed source paths and install counts", () => {
    const data = [{source:"owner/repo/../../etc",skillId:"bad",installs:20},{source:"owner/repo",skillId:"ok",installs:"100"}];
    expect(parseInitialSkills(JSON.stringify({initialSkills:data}))).toEqual([]);
    expect(parseInitialSkills('not a leaderboard')).toEqual([]);
  });
  it("identifies GitHub repository sources without treating domains as repositories", () => {
    expect(isGithubSource("vercel-labs/agent-skills")).toBe(true);
    expect(isGithubSource("open.feishu.cn")).toBe(false);
    expect(isGithubSource("https://example.com/repo")).toBe(false);
  });
  it("decodes rendered documents using UTF-8 byte lengths and rejects incomplete payloads", () => {
    const html="<h1>工具说明</h1><p>Original skill instructions and example.</p>";
    const flight=`0:{"previewHtml":"$2e","restHtml":""}\n2e:T${Buffer.byteLength(html).toString(16)},${html}`;
    expect(parseRenderedSkill(flight)).toBe(html);
    expect(parseRenderedSkill(flight.slice(0,-10))).toBeNull();
  });
  it("rejects API error objects and HTML shells returned with HTTP 200", () => {
    expect(parseSkillDocument('{"ResponseMetadata":{"Error":{"Code":"AccessDenied"}}}')).toBeNull();
    expect(parseSkillDocument('<html><body>Sign in</body></html>')).toBeNull();
    expect(parseSkillDocument('---\nname: tdd\ndescription: Test driven development.\n---\n# TDD')?.frontmatter?.name).toBe("tdd");
  });
});
describe("Skills install provenance", () => {
  it("withholds installation for metadata-only listings", () => {
    const p={ecosystem:"skills",name:"unknown",repoUrl:"https://github.com/acme/skills",skillDocumentAvailable:false} as Plugin;
    expect(installOptions(p)).toEqual([]);
  });
  it("resolves relative references from the actual nested skill directory", () => {
    const r=renderReadme("[Tests](tests.md)\n\n![Example](../example.png)","mattpocock/skills","skills/engineering/tdd/SKILL.md");
    expect(r.html).toContain("https://github.com/mattpocock/skills/blob/HEAD/skills/engineering/tdd/tests.md");
    expect(r.html).toContain("https://raw.githubusercontent.com/mattpocock/skills/HEAD/skills/engineering/example.png");
  });
  it("uses a well-known source URL without fabricating a GitHub repository", () => {
    const p={ecosystem:"skills",name:"lark-doc",repoUrl:"https://open.feishu.cn",sourceUrl:"https://open.feishu.cn"} as Plugin;
    expect(installOptions(p)).toHaveLength(1);
    expect(installOptions(p)[0].command).toBe("npx skills add https://open.feishu.cn --skill lark-doc");
  });
  it("quotes shell metacharacters in third-party skill names", () => {
    const p={ecosystem:"skills",name:"test; echo unsafe",repoUrl:"https://github.com/acme/skills"} as Plugin;
    expect(installOptions(p)[0].command).toContain("--skill 'test; echo unsafe'");
  });
  it("does not produce a git command for malformed repository URLs", () => {
    const p={ecosystem:"skills",name:"example",repoUrl:"https://github.com/acme/skills;echo unsafe"} as Plugin;
    expect(installOptions(p).some(i=>i.label==="git")).toBe(false);
    expect(installOptions(p)[0].command).toContain("'https://github.com/acme/skills;echo unsafe'");
  });
});
