#!/usr/bin/env node

/**
 * Sync AI assistant rules across different tools.
 *
 * This script reads the master rules from .cursor/rules/*.mdc files
 * and generates tool-specific configuration files:
 * - .rules (for Zed context server)
 * - .clauderc (for Claude Code)
 * - .idea/ai-assistant.xml (for WebStorm AI Assistant)
 *
 * Run this script whenever you update rules in .cursor/rules/
 */

// #region Imports

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// #endregion

// #region Configuration

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// #endregion

// #region Helper Functions

/**
 * Reads all MDC files from .cursor/rules/ directory.
 * Strips frontmatter from each file (content between --- markers).
 *
 * @returns Array of rule files with the name and content.
 */
function readCursorRules() {
    const rulesDir = join(rootDir, '.cursor', 'rules');

    try {
        const files = readdirSync(rulesDir);
        const mdcFiles = files.filter((file) => file.endsWith('.mdc'));

        if (mdcFiles.length === 0) {
            throw new Error('No .mdc files found in .cursor/rules directory');
        }

        return mdcFiles.map((file) => {
            const fullPath = join(rulesDir, file);
            const content = readFileSync(fullPath, 'utf-8');
            const name = file.replace('.mdc', '');

            // Strip frontmatter (between --- markers), handle both Unix and Windows line endings.
            const contentWithoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

            return { name, content: contentWithoutFrontmatter };
        });
    } catch (error) {
        console.error(`Error reading rules: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Combines all rule files into a single Markdown document.
 * Adds a header with a project description and generation notice.
 *
 * @param rules - Array of rule files to combine.
 * @returns Combined Markdown document.
 */
function combineRules(rules) {
    const header = `# Blit–Tech WebGPU Game Engine - Project Rules

You are working on Blit–Tech, a lightweight WebGPU retro game engine for
TypeScript inspired by RetroBlit. It provides pixel-perfect 2D rendering with
a clean, fantasy-console-style API.

---

> **Note**: This file is auto-generated from .cursor/rules/*.mdc files.
> To update these rules, edit the .mdc files and run: \`pnpm run sync-rules\`

---

`;

    const combined = rules.map((rule) => rule.content.trim()).join('\n\n---\n\n');

    return header + combined;
}

/**
 * Creates a condensed version for WebStorm XML by removing code examples.
 * Keeps inline code but replaces large code blocks with a reference.
 *
 * @param markdown - Original markdown content.
 * @returns Condensed markdown without code examples.
 */
function condenseForWebStorm(markdown) {
    // Remove large code blocks but keep inline code.
    const condensed = markdown
        .replace(/```[\s\S]*?```/g, '(see .rules for examples)')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return condensed;
}

/**
 * Generates WebStorm AI Assistant XML configuration.
 * Creates a properly formatted XML file with a CDATA section containing the rules.
 *
 * @param markdown - Markdown content to include in XML.
 * @returns XML document string.
 */
function generateWebStormXml(markdown) {
    const condensed = condenseForWebStorm(markdown);
    const safe = condensed.replace(/\]\]>/g, ']]]]><![CDATA[>');

    return `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="AIAssistantSettings">
    <option name="instructions">
      <value>
        <![CDATA[
${safe}
        ]]>
      </value>
    </option>
  </component>
</project>
`;
}

/**
 * Writes content to a file and logs the operation.
 *
 * @param filePath - Path to write to.
 * @param content - Content to write.
 * @param description - Description for logging.
 */
function writeRuleFile(filePath, content, description) {
    try {
        writeFileSync(filePath, content, 'utf-8');
        console.log(`   ✓ Written to ${description}\n`);
    } catch (error) {
        console.error(`   ✗ Failed to write to ${description} (${filePath}): ${error.message}`);
        process.exit(1);
    }
}

// #endregion

// #region Main Logic

/**
 * Main execution function.
 * Orchestrates the entire rule syncing process.
 */
function main() {
    console.log('Syncing AI assistant rules...\n');

    // Step 1: Read master rules from Cursor.
    console.log('1. Reading master rules from .cursor/rules/*.mdc');
    const rules = readCursorRules();
    console.log(`   Found ${rules.length} rule files: ${rules.map((r) => r.name).join(', ')}\n`);

    // Step 2: Combine into a single Markdown document.
    console.log('2. Combining rules into unified format');
    const combinedMarkdown = combineRules(rules);
    console.log(`   Generated ${combinedMarkdown.split('\n').length} lines of markdown\n`);

    // Step 3: Generate .rules (for Zed).
    console.log('3. Generating .rules (for Zed)');
    const rulesPath = join(rootDir, '.rules');
    writeRuleFile(rulesPath, combinedMarkdown, '.rules');

    // Step 4: Generate .clauderc (for Claude Code).
    console.log('4. Generating .clauderc (for Claude Code)');
    const claudercPath = join(rootDir, '.clauderc');
    writeRuleFile(claudercPath, combinedMarkdown, '.clauderc');

    // Step 5: Generate WebStorm XML.
    console.log('5. Generating .idea/ai-assistant.xml (for WebStorm)');
    const ideaDir = join(rootDir, '.idea');
    mkdirSync(ideaDir, { recursive: true });

    const webstormXml = generateWebStormXml(combinedMarkdown);
    const webstormPath = join(ideaDir, 'ai-assistant.xml');
    writeRuleFile(webstormPath, webstormXml, '.idea/ai-assistant.xml');

    // Summary.
    console.log('✓ All rules synced successfully!');
    console.log('\nFiles generated:');
    console.log('  - .rules (Zed)');
    console.log('  - .clauderc (Claude Code)');
    console.log('  - .idea/ai-assistant.xml (WebStorm)');
    console.log('\nSource of truth: .cursor/rules/*.mdc');
}

// #endregion

// #region Execution

main();

// #endregion
