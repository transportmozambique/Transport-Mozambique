type LoadingScreenProps = {
  /** Kept for call-site compatibility; loading UI is text-free */
  message?: string;
  layout?: "viewport" | "panel";
  size?: "default" | "compact";
};

function LoopOrbit({
  className,
}: {
  className?: string;
}) {
  const c = 24;
  const r = 18;
  return (
    <svg
      viewBox="0 0 48 48"
      className={["text-neutral-800", className].filter(Boolean).join(" ")}
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
          opacity={0.18}
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
}: LoadingScreenProps) {
  if (size === "compact") {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-busy="true">
        <span className="sr-only">Loading</span>
        <LoopOrbit className="h-7 w-7 shrink-0" />
      </div>
    );
  }

  const shell =
    layout === "panel"
      ? "absolute inset-0 z-10 flex items-center justify-center bg-white"
      : "flex min-h-screen items-center justify-center bg-white";

  return (
    <div className={shell} role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <LoopOrbit className="h-10 w-10 shrink-0" />
    </div>
  );
}
