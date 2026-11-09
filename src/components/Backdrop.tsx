export function Backdrop() {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="blob animate-drift"
          style={{
            width: "52vw",
            height: "52vw",
            left: "-14vw",
            top: "-18vw",
            background:
              "radial-gradient(circle at 40% 40%, rgba(139,92,246,.55), rgba(76,29,149,.15) 62%, transparent 72%)",
            animationDelay: "-6s",
          }}
        />
        <div
          className="blob animate-drift-slow"
          style={{
            width: "44vw",
            height: "44vw",
            right: "-12vw",
            top: "-8vw",
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,107,90,.42), rgba(190,24,93,.14) 60%, transparent 72%)",
          }}
        />
        <div
          className="blob animate-drift"
          style={{
            width: "48vw",
            height: "42vw",
            left: "22vw",
            bottom: "-24vw",
            background:
              "radial-gradient(circle at 50% 50%, rgba(123,224,180,.28), rgba(20,184,166,.08) 62%, transparent 74%)",
            animationDelay: "-14s",
          }}
        />
        <div className="absolute inset-0 hero-grid opacity-70" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-ink-950/70 to-transparent" />
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}
