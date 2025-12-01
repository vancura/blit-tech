#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * BMFont to .btfont Converter
 *
 * Converts BMFont XML format (.fnt + .png) to Blit-Tech's .btfont JSON format.
 *
 * Usage:
 *   node convert-bmfont.mjs <input.fnt> <output.btfont> [--embed]
 *
 * Options:
 *   --embed    Embed the texture as base64 instead of referencing it
 *
 * Examples:
 *   node convert-bmfont.mjs fonts/MyFont.fnt fonts/MyFont.btfont
 *   node convert-bmfont.mjs fonts/MyFont.fnt fonts/MyFont.btfont --embed
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Parse an XML attribute value from a tag string.
 * @param {string} tag - The XML tag string
 * @param {string} attr - The attribute name to extract
 * @returns {string|null} The attribute value or null if not found
 */
function parseXmlAttribute(tag, attr) {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = tag.match(regex);

    return match ? match[1] : null;
}

/**
 * Parse info tag from XML data.
 * @param {string} xmlData - The XML font data
 * @returns {{fontName: string, fontSize: number}} Parsed font info
 */
function parseInfoTag(xmlData) {
    const infoMatch = xmlData.match(/<info[^>]+>/);

    if (!infoMatch) {
        console.error('Error: Could not find <info> tag in font file');
        process.exit(1);
    }

    const fontName = parseXmlAttribute(infoMatch[0], 'face') || 'Unknown';
    const fontSize = Math.abs(parseInt(parseXmlAttribute(infoMatch[0], 'size') || '12', 10));

    return { fontName, fontSize };
}

/**
 * Parse common tag from XML data.
 * @param {string} xmlData - The XML font data
 * @param {number} fontSize - Default font size
 * @returns {{lineHeight: number, baseline: number}} Parsed common properties
 */
function parseCommonTag(xmlData, fontSize) {
    const commonMatch = xmlData.match(/<common[^>]+>/);

    if (!commonMatch) {
        console.error('Error: Could not find <common> tag in font file');
        process.exit(1);
    }

    const lineHeight = parseInt(parseXmlAttribute(commonMatch[0], 'lineHeight') || String(fontSize), 10);
    const baseline = parseInt(parseXmlAttribute(commonMatch[0], 'base') || String(fontSize), 10);

    return { lineHeight, baseline };
}

/**
 * Parse page tag from XML data to get texture filename.
 * @param {string} xmlData - The XML font data
 * @returns {string} Texture filename
 */
function parsePageTag(xmlData) {
    const pageMatch = xmlData.match(/<page[^>]+>/);

    if (!pageMatch) {
        console.error('Error: Could not find <page> tag in font file');
        process.exit(1);
    }

    const textureFilename = parseXmlAttribute(pageMatch[0], 'file');

    if (!textureFilename) {
        console.error('Error: Could not find texture filename in <page> tag');
        process.exit(1);
    }

    return textureFilename;
}

/**
 * Get texture value (either base64 embedded or relative path).
 * @param {boolean} embedTexture - Whether to embed as base64
 * @param {string} textureFilename - Texture filename
 * @param {string} fntDir - Directory of the .fnt file
 * @param {string} outputPath - Output file path
 * @returns {string} Texture value (base64 data URI or path)
 */
function getTextureValue(embedTexture, textureFilename, fntDir, outputPath) {
    const texturePath = join(fntDir, textureFilename);

    if (embedTexture) {
        if (!existsSync(texturePath)) {
            console.error(`Error: Texture file not found: ${texturePath}`);
            process.exit(1);
        }

        console.log(`Embedding texture: ${texturePath}`);

        const pngData = readFileSync(texturePath);
        const base64 = pngData.toString('base64');

        console.log(`  Texture size: ${base64.length} bytes (base64)`);

        return `data:image/png;base64,${base64}`;
    }

    // Use relative path from output file to texture
    const outputDir = dirname(outputPath);

    if (outputDir === fntDir) {
        // Same directory, just use filename
        const textureValue = textureFilename;

        console.log(`Texture reference: ${textureValue}`);

        return textureValue;
    }

    // Compute relative path from output directory to texture file
    const absoluteTexturePath = join(fntDir, textureFilename);
    const textureValue = relative(outputDir, absoluteTexturePath).replace(/\\/g, '/');

    console.log(`Texture reference: ${textureValue}`);

    return textureValue;
}

/**
 * Parse all glyphs from XML data.
 * @param {string} xmlData - The XML font data
 * @returns {Object} Glyphs object
 */
function parseGlyphs(xmlData) {
    // Use Object.create(null) to prevent prototype pollution
    const glyphs = Object.create(null);
    let glyphCount = 0;

    for (const charMatch of xmlData.matchAll(/<char[^>]+>/g)) {
        const tag = charMatch[0];
        const charCode = parseInt(parseXmlAttribute(tag, 'id') || '0', 10);
        const char = String.fromCharCode(charCode);

        // Use Object.defineProperty to safely set property and prevent prototype pollution
        Object.defineProperty(glyphs, char, {
            value: {
                x: parseInt(parseXmlAttribute(tag, 'x') || '0', 10),
                y: parseInt(parseXmlAttribute(tag, 'y') || '0', 10),
                w: parseInt(parseXmlAttribute(tag, 'width') || '0', 10),
                h: parseInt(parseXmlAttribute(tag, 'height') || '0', 10),
                ox: parseInt(parseXmlAttribute(tag, 'xoffset') || '0', 10),
                oy: parseInt(parseXmlAttribute(tag, 'yoffset') || '0', 10),
                adv: parseInt(parseXmlAttribute(tag, 'xadvance') || '0', 10),
            },
            writable: true,
            enumerable: true,
            configurable: true,
        });

        glyphCount++;
    }

    if (glyphCount === 0) {
        console.error('Error: No glyphs found in font file');
        process.exit(1);
    }

    return { glyphs, glyphCount };
}

/**
 * Write output file and log success message.
 * @param {string} outputPath - Output file path
 * @param {Object} btfont - The btfont object to write
 * @param {string} fontName - Font name
 * @param {number} fontSize - Font size
 * @param {number} lineHeight - Line height
 * @param {number} baseline - Baseline
 * @param {number} glyphCount - Number of glyphs
 */
function writeOutput(outputPath, btfont, fontName, fontSize, lineHeight, baseline, glyphCount) {
    writeFileSync(outputPath, JSON.stringify(btfont, null, 2));

    console.log(`\nConverted successfully!`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Font: ${fontName} ${fontSize}pt`);
    console.log(`  Line height: ${lineHeight}px`);
    console.log(`  Baseline: ${baseline}px`);
    console.log(`  Glyphs: ${glyphCount}`);
}

/**
 * Convert a BMFont XML file to .btfont format.
 * @param {string} fntPath - Path to the .fnt file
 * @param {string} outputPath - Path for the output .btfont file
 * @param {boolean} embedTexture - Whether to embed the texture as base64
 */
function convertBMFont(fntPath, outputPath, embedTexture = false) {
    // Validate input file exists
    if (!existsSync(fntPath)) {
        console.error(`Error: Input file not found: ${fntPath}`);
        process.exit(1);
    }

    console.log(`Reading: ${fntPath}`);

    // Read the XML font file
    const xmlData = readFileSync(fntPath, 'utf-8');
    const fntDir = dirname(fntPath);

    // Parse XML tags
    const { fontName, fontSize } = parseInfoTag(xmlData);
    const { lineHeight, baseline } = parseCommonTag(xmlData, fontSize);
    const textureFilename = parsePageTag(xmlData);
    const textureValue = getTextureValue(embedTexture, textureFilename, fntDir, outputPath);
    const { glyphs, glyphCount } = parseGlyphs(xmlData);

    // Create the .btfont structure
    const btfont = {
        name: fontName,
        size: fontSize,
        lineHeight,
        baseline,
        texture: textureValue,
        glyphs,
    };

    // Write the output
    writeOutput(outputPath, btfont, fontName, fontSize, lineHeight, baseline, glyphCount);
}

// Main entry point
function main() {
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(`
BMFont to .btfont Converter

Converts BMFont XML format (.fnt + .png) to Blit-Tech's .btfont JSON format.

Usage:
  node convert-bmfont.mjs <input.fnt> <output.btfont> [--embed]

Options:
  --embed    Embed the texture as base64 instead of referencing it
  --help     Show this help message

Examples:
  node convert-bmfont.mjs fonts/MyFont.fnt fonts/MyFont.btfont
  node convert-bmfont.mjs fonts/MyFont.fnt fonts/MyFont.btfont --embed
`);
        process.exit(0);
    }

    // Parse arguments
    const embedTexture = args.includes('--embed');
    const paths = args.filter((arg) => !arg.startsWith('--'));

    if (paths.length < 2) {
        console.error('Error: Please provide input and output paths');
        console.error('Usage: node convert-bmfont.mjs <input.fnt> <output.btfont> [--embed]');

        process.exit(1);
    }

    const [inputPath, outputPath] = paths;

    // Run conversion
    convertBMFont(inputPath, outputPath, embedTexture);
}

main();
