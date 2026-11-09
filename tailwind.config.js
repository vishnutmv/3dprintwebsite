/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07040f",
          900: "#0b0718",
          800: "#110b22",
          700: "#191033",
        },
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
        coral: "#ff6b5a",
        sun: "#ffd43b",
        mint: "#7be0b4",
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
        glass: "0 24px 60px -24px rgba(5,2,20,.85), inset 0 1px 0 rgba(255,255,255,.14)",
        glow: "0 0 0 1px rgba(167,139,250,.35), 0 18px 60px -18px rgba(139,92,246,.65)",
        lift: "0 34px 80px -30px rgba(5,2,20,.95)",
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
