/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0f1111",
          900: "#131921",
          800: "#232f3e",
          700: "#37475a",
        },
        // Kept under the original names so existing components adapt together.
        // These now carry the Amazon-style action colours.
        violet: {
          400: "#febd69",
          500: "#f3a847",
          600: "#e08e1b",
        },
        lime: {
          300: "#ffe98a",
          400: "#ffd814",
          500: "#f7ca00",
          600: "#e6b800",
        },
        coral: "#cc0c39",
        sun: "#c45500",
        mint: "#067d62",
      },
      fontFamily: {
        sans: ["Amazon Ember", "Inter", "Arial", "Helvetica Neue", "system-ui", "sans-serif"],
        display: ["Amazon Ember", "Inter", "Arial", "Helvetica Neue", "system-ui", "sans-serif"],
        mono: ["Consolas", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "6px",
        "2xl": "8px",
        "3xl": "8px",
        "4xl": "10px",
      },
      boxShadow: {
        glass: "0 1px 2px rgba(15,23,25,.06)",
        glow: "0 0 0 3px rgba(255,216,20,.35)",
        lift: "0 4px 14px -6px rgba(15,23,25,.18)",
        lime: "0 2px 6px rgba(15,23,25,.14)",
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
