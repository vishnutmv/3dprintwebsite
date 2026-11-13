/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#f8f7f3",
          900: "#f1efe9",
          800: "#e8e5dc",
          700: "#ddd9cf",
        },
        violet: {
          400: "#e98957",
          500: "#d86e40",
          600: "#bd5530",
        },
        coral: "#bd4f3d",
        sun: "#a87716",
        mint: "#39785a",
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
        display: ['"Segoe UI Variable Display"', "Inter", "system-ui", "sans-serif"],
        mono: ['"Cascadia Mono"', "Consolas", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glass: "0 18px 44px -28px rgba(37,34,24,.24), inset 0 1px 0 rgba(255,255,255,.8)",
        glow: "0 0 0 1px rgba(216,110,64,.18), 0 14px 36px -18px rgba(189,85,48,.25)",
        lift: "0 28px 60px -34px rgba(37,34,24,.32)",
      },
      keyframes: {
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%,-6%,0) scale(1.06)" },
          "66%": { transform: "translate3d(-5%,4%,0) scale(.97)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pop: {
          "0%": { opacity: "0", transform: "translateY(14px) scale(.98)" },
          "100%": { opacity: "1", transform: "none" },
        },
      },
      animation: {
        drift: "drift 22s ease-in-out infinite",
        "drift-slow": "drift 34s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        shimmer: "shimmer 2.6s linear infinite",
        pop: "pop .5s cubic-bezier(.2,.8,.3,1) both",
      },
    },
  },
  plugins: [],
};
