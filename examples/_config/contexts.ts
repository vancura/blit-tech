/**
 * Context data for example pages.
 * Each key is the HTML filename, values are Handlebars template variables.
 */
export const exampleContexts: Record<string, Record<string, string>> = {
    'basics.html': {
        title: 'Blit–Tech - Basic Example',
        h1Title: 'Blit–Tech Basic Example',
        scriptFile: 'basics',
    },

    'primitives.html': {
        title: 'Blit–Tech - Primitives Demo',
        h1Title: 'Blit–Tech Primitives Demo',
        scriptFile: 'primitives',
    },

    'camera.html': {
        title: 'Blit–Tech - Camera Demo',
        h1Title: 'Blit–Tech Camera Demo',
        scriptFile: 'camera',
    },

    'patterns.html': {
        title: 'Blit–Tech - Patterns Demo',
        h1Title: 'Blit–Tech Patterns Demo',
        scriptFile: 'patterns',
    },

    'sprites.html': {
        title: 'Blit–Tech - Sprite Demo',
        h1Title: 'Blit–Tech Sprite Demo',
        scriptFile: 'sprites',
    },

    'fonts.html': {
        title: 'Blit–Tech - Bitmap Font Demo',
        h1Title: 'Blit–Tech Bitmap Font Demo',
        scriptFile: 'fonts',
    },
};
