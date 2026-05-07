/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
        },
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(900px circle at 10% 10%, rgba(59,130,246,.22), transparent 55%), radial-gradient(800px circle at 90% 20%, rgba(249,115,22,.20), transparent 55%), radial-gradient(700px circle at 55% 90%, rgba(16,185,129,.15), transparent 60%)",
      },
    },
  },
  plugins: [],
};
