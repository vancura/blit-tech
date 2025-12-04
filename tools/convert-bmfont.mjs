#!/usr/bin/env node

/**
 * BMFont to .btfont Converter
 *
 * Converts BMFont XML format (.fnt + .png) to Blit–Tech's .btfont JSON format.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Extracts the value of a specified attribute from an XML tag.
 *
 * @param {string} tag - The XML tag string from which to extract the attribute value.
 * @param {string} attr - The name of the attribute to extract.
 * @returns {string|null} The value of the specified attribute, or null if the attribute is not found.
 */
function parseXmlAttribute(tag, attr) {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = tag.match(regex);
    return match ? match[1] : null;
}

/**
 * Parses the `<info>` XML tag from the provided font file data and extracts the font name and size.
 *
 * @param {string} xmlData - The XML data containing the font information, including the `<info>` tag.
 * @returns {{fontName: string, fontSize: number}} An object containing the `fontName` and `fontSize` extracted from the `<info>` tag. Defaults to 'Unknown' for font name and 12 for font size if attributes are missing.
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
 * Parses the `<common>` tag from the provided XML data and extracts font-related attributes.
 *
 * @param {string} xmlData - The XML data containing the `<common>` tag.
 * @param {number} fontSize - The font size to be used as a fallback value if attributes are missing.
 * @returns {{lineHeight: number, baseline: number}} An object containing the parsed `lineHeight` and `baseline` values from the `<common>` tag.
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
 * Parses the <page> tag in the provided XML data to extract the texture file name.
 * Logs an error and terminates the process if the <page> tag or texture file name is missing.
 *
 * @param {string} xmlData The XML data containing the <page> tag to be parsed.
 * @returns {string} The texture file name extracted from the <page> tag.
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
 * Generates and returns the appropriate texture value based on the specified options.
 * This can either be an embedded base64 representation of the texture or a path to the texture file.
 *
 * @param {boolean} embedTexture - Indicates whether the texture should be embedded in base64 format.
 * @param {string} textureFilename - The filename of the texture file to be used.
 * @param {string} fntDir - The directory where the texture file is located.
 * @param {string} outputPath - The output file path used for computing relative paths, if embedding is disabled.
 * @returns {string} The texture value, either as a base64-encoded string or a relative path.
 */
function getTextureValue(embedTexture, textureFilename, fntDir, outputPath) {
    let textureValue;
    const texturePath = join(fntDir, textureFilename);

    if (embedTexture) {
        // Validate texture file existence
        if (!existsSync(texturePath)) {
            console.error(`Error: Texture file not found: ${texturePath}`);
            process.exit(1);
        }

        console.log(`Embedding texture: ${texturePath}`);

        try {
            const pngData = readFileSync(texturePath);
            const base64 = pngData.toString('base64');
            console.log(`  Texture size: ${base64.length} bytes (base64)`);
            textureValue = `data:image/png;base64,${base64}`;
        } catch (error) {
            console.error(`Error reading texture file: ${error.message}`);
            process.exit(1);
        }
    } else {
        // Use relative path from output file to texture
        const outputDir = dirname(outputPath);

        // Compute a relative path from the output directory to the texture file
        textureValue = relative(outputDir, texturePath).replace(/\\/g, '/');

        console.log(`Texture reference: ${textureValue}`);
    }

    return textureValue;
}

/**
 * Parses glyph data from a given XML tag and updates the glyphs object with the corresponding character's properties.
 *
 * @param {Object} glyphs - The object representing all glyph data, which will be updated with the parsed character information.
 * @param {string} char - The character corresponding to the glyph data being parsed.
 * @param {String} tag - The XML tag containing the attributes for the glyph's properties.
 * @returns {void} Does not return a value; updates the glyphs object directly with parsed data.
 */
function parseGlyphData(glyphs, char, tag) {
    // eslint-disable-next-line security/detect-object-injection
    glyphs[char] = {
        x: parseInt(parseXmlAttribute(tag, 'x') || '0', 10),
        y: parseInt(parseXmlAttribute(tag, 'y') || '0', 10),
        w: parseInt(parseXmlAttribute(tag, 'width') || '0', 10),
        h: parseInt(parseXmlAttribute(tag, 'height') || '0', 10),
        ox: parseInt(parseXmlAttribute(tag, 'xoffset') || '0', 10),
        oy: parseInt(parseXmlAttribute(tag, 'yoffset') || '0', 10),
        adv: parseInt(parseXmlAttribute(tag, 'xadvance') || '0', 10),
    };
}

/**
 * Parses glyph data from an XML string containing font information and extracts individual character properties.
 *
 * @param {string} xmlData - The XML string containing font glyph definitions.
 * @returns {{glyphs: Object, glyphCount: number}} An object containing the parsed glyphs as key-value pairs and the total count of glyphs found.
 */
function parseGlyphs(xmlData) {
    const glyphs = Object.create(null); // use Object.create(null) to prevent prototype pollution
    let glyphCount = 0;

    for (const charMatch of xmlData.matchAll(/<char[^>]+>/g)) {
        const tag = charMatch[0];
        const charCode = parseInt(parseXmlAttribute(tag, 'id') || '0', 10);
        const char = String.fromCharCode(charCode);

        parseGlyphData(glyphs, char, tag);

        glyphCount++;
    }

    if (glyphCount === 0) {
        console.error('Error: No glyphs found in font file');
        process.exit(1);
    }

    return { glyphs, glyphCount };
}

// noinspection OverlyComplexFunctionJS
/**
 * Writes the given font data to a file and logs the conversion details.
 *
 * @param {string} outputPath - The file path where the font data will be written.
 * @param {object} btfont - The font data to be serialized and written to the file.
 * @param {string} fontName - The name of the font being processed.
 * @param {number} fontSize - The size of the font, in points.
 * @param {number} lineHeight - The line height of the font, in pixels.
 * @param {number} baseline - The baseline offset of the font, in pixels.
 * @param {number} glyphCount - The total number of glyphs in the font.
 * @returns {void} This function does not return a value.
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
 * Converts a BMFont `.fnt` file to a `.btfont` format file.
 *
 * @param {string} fntPath - The file path to the input `.fnt` file. This should be a valid BMFont XML file.
 * @param {string} outputPath - The file path where the converted `.btfont` file will be saved.
 * @param {boolean} [embedTexture=false] - Whether to embed the texture file as a base64-encoded string within the output `.btfont` file. Defaults to `false`.
 * @returns {void} Does not return a value. The converted file is saved to the specified output path.
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

/**
 * Main function that serves as the entry point for the BMFont to .btfont converter.
 * It processes command-line arguments, provides help instructions, and initiates the
 * conversion process from BMFont XML format to Blit–Tech's .btfont JSON format.
 *
 * Error cases:
 * - If no arguments are provided or insufficient arguments are passed, an error message
 *   is displayed along with usage instructions, and the program exits with an error code.
 *
 * @returns {void} This function does not return a value. It either executes the
 * conversion process or exits the process with a relevant status code.
 */
function main() {
    const args = process.argv.slice(2);

    // Check for the help flag
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(`
BMFont to .btfont Converter

Converts BMFont XML format (.fnt + .png) to Blit–Tech’s .btfont JSON format.

Usage:
  node convert-bmfont.mjs <input.fnt> <output.btfont> [--embed]

Options:
  --embed    Embed the texture as base64 instead of referencing it
  -h --help  Show this help message

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
