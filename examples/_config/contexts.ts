/**
 * Context data for example pages.
 * Each key is the HTML filename, values are Handlebars template variables.
 */
export const exampleContexts: Record<string, Record<string, string>> = {
    'basics.html': {
        title: 'Blit-Tech - Basic Example',
        h1Title: 'Blit-Tech Basic Example',
        backgroundGradient: '#1a1a1a',
        accentColor: '#4caf50',
        infoHeadingColor: '#4caf50',
        backLinkBg: 'rgba(76, 175, 80, 0.3)',
        backLinkHover: 'rgba(76, 175, 80, 0.5)',
        scriptFile: 'basics',
    },

    'primitives.html': {
        title: 'Blit-Tech - Primitives Demo',
        h1Title: 'Blit-Tech Primitives Demo',
        backgroundGradient: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        accentColor: '#4a90e2',
        infoHeadingColor: '#4a90e2',
        backLinkBg: 'rgba(74, 144, 226, 0.3)',
        backLinkHover: 'rgba(74, 144, 226, 0.5)',
        scriptFile: 'primitives',
    },

    'camera.html': {
        title: 'Blit-Tech - Camera Demo',
        h1Title: 'Blit-Tech Camera Demo',
        backgroundGradient: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
        accentColor: '#71b280',
        infoHeadingColor: '#71b280',
        backLinkBg: 'rgba(113, 178, 128, 0.3)',
        backLinkHover: 'rgba(113, 178, 128, 0.5)',
        scriptFile: 'camera',
    },

    'patterns.html': {
        title: 'Blit-Tech - Patterns Demo',
        h1Title: 'Blit-Tech Patterns Demo',
        backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        accentColor: '#764ba2',
        infoHeadingColor: '#a78bfa',
        backLinkBg: 'rgba(118, 75, 162, 0.3)',
        backLinkHover: 'rgba(118, 75, 162, 0.5)',
        scriptFile: 'patterns',
    },

    'sprites.html': {
        title: 'Blit-Tech - Sprite Demo',
        h1Title: 'Blit-Tech Sprite Demo',
        backgroundGradient: 'linear-gradient(135deg, #1e3a5e 0%, #71a0b2 100%)',
        accentColor: '#71a0b2',
        infoHeadingColor: '#71a0b2',
        backLinkBg: 'rgba(113, 160, 178, 0.3)',
        backLinkHover: 'rgba(113, 160, 178, 0.5)',
        scriptFile: 'sprites',
    },

    'fonts.html': {
        title: 'Blit-Tech - Bitmap Font Demo',
        h1Title: 'Blit-Tech Bitmap Font Demo',
        backgroundGradient: 'linear-gradient(135deg, #4e134e 0%, #b28071 100%)',
        accentColor: '#b28071',
        infoHeadingColor: '#b28071',
        backLinkBg: 'rgba(178, 128, 113, 0.3)',
        backLinkHover: 'rgba(178, 128, 113, 0.5)',
        scriptFile: 'fonts',
    },
};
