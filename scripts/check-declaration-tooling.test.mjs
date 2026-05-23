import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    DRIFT_WARNING_PATTERNS,
    findAlignmentFailures,
    findDriftWarnings,
    findMissingBtDeclarationMembers,
    validateDeclarationTooling,
} from './check-declaration-tooling.mjs';

describe('check-declaration-tooling', () => {
    it('exports at least one drift warning pattern', () => {
        assert.ok(DRIFT_WARNING_PATTERNS.length > 0);
    });

    it('detects known drift warning substrings', () => {
        const log = 'WARNING: TypeScript version used for analysis is different from the compiler version';
        const warnings = findDriftWarnings(log);
        assert.equal(warnings.length, 1);
    });

    it('passes a clean alignment log', () => {
        const log =
            '[vite:dts] Analysis will use the bundled TypeScript version 5.9.3\n[vite:dts] Declaration files built';
        assert.deepEqual(findDriftWarnings(log), []);
        assert.deepEqual(findAlignmentFailures(log, '5.9.3'), []);
    });

    it('fails when bundled TypeScript version does not match workspace pin', () => {
        const log = 'Analysis will use the bundled TypeScript version 6.0.3';
        const failures = findAlignmentFailures(log, '5.9.3');
        assert.equal(failures.length, 1);
        assert.match(failures[0], /does not match workspace pin/);
    });

    it('fails when alignment log line is missing', () => {
        const failures = findAlignmentFailures('built in 1200ms', '5.9.3');
        assert.equal(failures.length, 1);
        assert.match(failures[0], /was not found/);
    });

    it('validateDeclarationTooling skips output file when disabled', () => {
        const log = 'Analysis will use the bundled TypeScript version 5.9.3';
        const failures = validateDeclarationTooling(log, { requireOutputFile: false });
        assert.deepEqual(failures, []);
    });

    it('findMissingBtDeclarationMembers fails when requestedBackend is absent', () => {
        const dts = 'declare namespace BT { readonly activeBackend: Backend | null; }';
        const failures = findMissingBtDeclarationMembers(dts);
        assert.equal(failures.length, 1);
        assert.match(failures[0], /requestedBackend/);
    });

    it('findMissingBtDeclarationMembers passes when required getters are present', () => {
        const dts = [
            'declare namespace BT {',
            '  readonly requestedBackend: Backend | null;',
            '  readonly activeBackend: Backend | null;',
            '}',
        ].join('\n');
        assert.deepEqual(findMissingBtDeclarationMembers(dts), []);
    });
});
