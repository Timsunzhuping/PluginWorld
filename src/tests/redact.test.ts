import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../scripts/sync/lib";

describe("redactSecrets: secret redaction in third-party READMEs", () => {
  it("redacts Slack webhook", () => {
    // Build the fake URL at runtime so the test fixture itself does not trip secret scanners
    const fakeHook =
      "https://hooks.slack.com/" + ["services", "T00000000", "B00000000", "X".repeat(24)].join("/");
    expect(redactSecrets(`post to ${fakeHook} now`)).toBe(
      "post to https://hooks.slack.com/services/REDACTED now",
    );
  });
  it("redacts GitHub token / OpenAI key / AWS key", () => {
    expect(redactSecrets("ghp_abcdefghijklmnopqrstuvwxyz012345")).toBe("gh?_REDACTED");
    expect(redactSecrets("sk-abcdefghijklmnopqrstuvwxyz")).toBe("sk-REDACTED");
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA_REDACTED");
  });
  it("leaves normal text untouched", () => {
    const text = "Install with npm install sk-plugin and enjoy ghost mode";
    expect(redactSecrets(text)).toBe(text);
  });
});
