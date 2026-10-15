type LoadingScreenProps = {
  /** Full window (login, redirects). Admin app main area uses `admin`. */
  layout?: "viewport" | "admin";
  /** Table-level spinner; no full-bleed overlay */
  size?: "default" | "compact";
  /** Dark full-screen shell (e.g. root redirect before route) */
  tone?: "light" | "dark";
};

function LoopOrbit({
  className,
  tone,
}: {
  className?: string;
  tone: "light" | "dark";
}) {
  const c = 24;
  const r = 18;
  const strokeClass = tone === "dark" ? "text-white" : "text-neutral-800";
  return (
    <svg
      viewBox="0 0 48 48"
      className={[strokeClass, "animate-spin", className].filter(Boolean).join(" ")}
      fill="none"
      aria-hidden
    >
      <g transform={`rotate(-90 ${c} ${c})`}>
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="currentColor"
          strokeWidth={2.5}
          opacity={tone === "dark" ? 0.22 : 0.18}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="animate-loading-loop"
        />
      </g>
    </svg>
  );
}

export default function LoadingScreen({
  layout = "viewport",
  size = "default",
  tone = "light",
}: LoadingScreenProps) {
  const orbitTone = tone;

  if (size === "compact") {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-busy="true">
        <span className="sr-only">Loading</span>
        <LoopOrbit className="h-7 w-7 shrink-0" tone="light" />
      </div>
    );
  }

  const shellLight =
    layout === "admin"
      ? "absolute inset-0 z-10 flex items-center justify-center bg-gray-50"
      : "flex min-h-screen items-center justify-center bg-gray-50";

  const shellDark =
    "flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800";

  const shell = tone === "dark" ? shellDark : shellLight;

  return (
    <div className={shell} role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <LoopOrbit className="h-10 w-10 shrink-0" tone={orbitTone} />
    </div>
  );
}
