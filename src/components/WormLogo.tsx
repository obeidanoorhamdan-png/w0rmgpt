import { cn } from "@/lib/utils";

/** WORM GPT emblem with rotating rings and a clean W wordmark. */
export function WormLogo({
  size = 48,
  withText = true,
  tagline = false,
  className,
}: {
  size?: number;
  withText?: boolean;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)} dir="ltr">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 animate-worm-spin">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="10 8" opacity=".9" />
        </svg>
        <svg viewBox="0 0 100 100" className="absolute inset-0 animate-worm-spin-rev">
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeDasharray="2 6" opacity=".8" />
        </svg>
        <svg viewBox="0 0 100 100" className="absolute inset-0 animate-worm-pulse">
          <path
            d="M24 36 L34 66 L44 44 L50 60 L56 44 L66 66 L76 36"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="160"
            strokeDashoffset="160"
            style={{ animation: "worm-dash 1.4s ease-out forwards" }}
          />
          <circle cx="50" cy="26" r="4" fill="var(--foreground)" />
        </svg>
      </div>
      {withText && (
        <div className="leading-none">
          <div className="font-display text-xl font-black tracking-wider animate-worm-glitch">
            <span className="text-foreground">WORM</span> <span className="text-primary">GPT</span>
          </div>
          <div className="mt-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            {tagline ? "MORE POWER. LESS LIMITS." : "V1.0"}
          </div>
        </div>
      )}
    </div>
  );
}
