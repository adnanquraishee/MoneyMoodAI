/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#dc4600',
                secondary: '#4361ee',
                success: '#00ff9d',
                danger: '#ff4757',
                warning: '#ffb703',
                dark: '#0a0e17',
                'panel-bg': 'rgba(23, 32, 50, 0.7)',
                glass: 'rgba(23, 32, 50, 0.7)',
            },
            backdropBlur: {
                glass: '12px',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
