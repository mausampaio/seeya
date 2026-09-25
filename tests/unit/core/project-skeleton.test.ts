import { describe, expect, it } from 'vitest';
import { buildProjectSkeleton } from '@seeya-ai/engine/core/project-skeleton.js';

describe('buildProjectSkeleton', () => {
  it('uses the given id as both id and name — no invented display name (D-025)', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    expect(skeleton.manifest.id).toBe('auth-hardening');
    expect(skeleton.manifest.name).toBe('auth-hardening');
  });

  it('leaves defaultHarness null — nothing was chosen yet (D-025)', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    expect(skeleton.manifest.defaultHarness).toBeNull();
  });

  it('starts with no repositories or trackers', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    expect(skeleton.manifest.repositories).toEqual([]);
    expect(skeleton.manifest.trackers).toEqual([]);
  });

  it('writes exactly AGENTS.md and INDEX.md — never CLAUDE.md (D-030), never seeya.json (the adapter serializes that itself), and never the harness hook config (V2-T34, PO review: regenerated fresh by every "open" instead, never tracked)', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    const paths = skeleton.files.map((file) => file.relativePath).sort();
    expect(paths).toEqual(['AGENTS.md', 'INDEX.md']);
  });

  it('AGENTS.md names the project by id and has a "Working in this project" section (V2-T34 item 6)', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    const agentsMd = skeleton.files.find((file) => file.relativePath === 'AGENTS.md');
    expect(agentsMd?.content).toContain('seeya project "auth-hardening"');
    expect(agentsMd?.content).toContain('## Working in this project');
    expect(agentsMd?.content).toContain('Commit as you go');
  });

  it('creates the six directories docs/V2-RUMO.md lays out', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    expect([...skeleton.directories].sort()).toEqual(
      ['context', 'decisions', 'journal', 'plans', 'references', 'status'].sort(),
    );
  });

  it('AGENTS.md names every directory and points to INDEX.md', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    const agentsMd = skeleton.files.find((file) => file.relativePath === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd?.content).toContain('INDEX.md');
    for (const dir of skeleton.directories) {
      expect(agentsMd?.content).toContain(`${dir}/`);
    }
  });

  it('INDEX.md says the project is empty and points to AGENTS.md', () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    const indexMd = skeleton.files.find((file) => file.relativePath === 'INDEX.md');
    expect(indexMd?.content.toLowerCase()).toContain('empty');
    expect(indexMd?.content).toContain('AGENTS.md');
  });

  it("never mentions the project id's own literal work — no invented content about what the project does", () => {
    const skeleton = buildProjectSkeleton('auth-hardening');
    for (const file of skeleton.files) {
      // The only place "auth-hardening" appears is as the id/title itself, never woven into a
      // sentence claiming something about the work (which would be an invented claim, AGENTS.md's
      // own "quando parar e perguntar").
      expect(file.content).not.toMatch(/auth-hardening (is|does|handles|fixes)/i);
    }
  });
});
