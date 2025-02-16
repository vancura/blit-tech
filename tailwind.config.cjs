module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

    theme: {
        extend: {
            fontFamily: {
                sans: ['"JetBrains Sans"', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace']
            },
            colors: {
                debug: '#f0f',
                background: '#000000',
                'primary-text': 'rgba(255, 255, 255, 0.87)',
                'button-border': 'rgba(255, 255, 255, 0.3)',
                'counter-bg': 'rgba(25, 25, 28, 0.5)'
            }
        }
    },

    plugins: []
};
