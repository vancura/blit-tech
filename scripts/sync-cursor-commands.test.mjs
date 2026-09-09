import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    buildCommandFiles,
    findOrphanCommandNames,
    rewriteParentLinks,
    stripFrontmatter,
} from './sync-cursor-commands.mjs';

describe('sync-cursor-commands', () => {
    describe('stripFrontmatter', () => {
        it('removes a leading frontmatter block', () => {
            const content = '---\nname: format\ndescription: Format code\n---\n\n# Format\n\nBody text.\n';
            assert.equal(stripFrontmatter(content), '# Format\n\nBody text.\n');
        });

        it('returns content unchanged when there is no frontmatter', () => {
            const content = '# Format\n\nBody text.\n';
            assert.equal(stripFrontmatter(content), content);
        });

        it('returns content unchanged when the opening --- is never closed', () => {
            const content = '---\nname: format\n\n# Format\n';
            assert.equal(stripFrontmatter(content), content);
        });

        it('does not strip a line that merely starts with --- but is not exactly ---', () => {
            const content = '---not-frontmatter\n\n# Format\n';
            assert.equal(stripFrontmatter(content), content);
        });
    });

    describe('rewriteParentLinks', () => {
        it('re-relativizes a ../ link one level up from a skill directory', () => {
            const content = 'See [the runbook](../../../docs/security/security-runbook.md) for detail.';
            const result = rewriteParentLinks(content, '.claude/skills/security-run');
            assert.equal(result, 'See [the runbook](../../docs/security/security-runbook.md) for detail.');
        });

        it('leaves closer-in links untouched', () => {
            const content = 'See [a rule](rules/foo.md) and [an anchor](#section).';
            assert.equal(rewriteParentLinks(content, '.claude/skills/format'), content);
        });

        it('leaves absolute URLs untouched', () => {
            const content = 'See [docs](https://blit386.dev/docs/guide).';
            assert.equal(rewriteParentLinks(content, '.claude/skills/format'), content);
        });
    });

    describe('buildCommandFiles', () => {
        it('strips frontmatter and rewrites links for each skill', () => {
            const skills = [{ name: 'format', skillMdContent: '---\nname: format\n---\n\n# Format\n\nBody.\n' }];
            const result = buildCommandFiles(skills);
            assert.deepEqual(result, [{ name: 'format', content: '# Format\n\nBody.\n' }]);
        });
    });

    describe('findOrphanCommandNames', () => {
        it('returns command names with no matching skill, sorted', () => {
            const orphans = findOrphanCommandNames(['format', 'retired-skill', 'test'], ['format', 'test']);
            assert.deepEqual(orphans, ['retired-skill']);
        });

        it('returns an empty array when every command has a matching skill', () => {
            assert.deepEqual(findOrphanCommandNames(['format'], ['format', 'test']), []);
        });
    });
});
