/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                pnr: {
                    purple: '#6B21A8',
                    indigo: '#4F46E5',
                    blue: '#3B82F6',
                    cyan: '#06B6D4',
                    teal: '#14B8A6',
                    green: '#22C55E',
                    yellow: '#EAB308',
                    orange: '#F97316',
                    red: '#EF4444',
                    slate: '#64748b',
                    dark: '#0f172a', // Adding a likely dark background color based on usage
                    card: '#1e293b'  // Adding a likely card background color
                }
            },
            fontFamily: {
                display: ['Inter', 'sans-serif'], // Assuming Inter is used or falling back
            }
        },
    },
    plugins: [],
}
