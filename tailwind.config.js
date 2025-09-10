/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0A66C2",
          dark: "#0f2138"
        }
      },
      borderRadius: {
        xl: "12px"
      }
    }
  },
  plugins: []
};
