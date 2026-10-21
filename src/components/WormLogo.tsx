import { cn } from "@/lib/utils";

/** Animated WORM GPT emblem: rotating rings + roaring flame + pulsing W + glitching wordmark. */
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
        {/* flame */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 animate-flame" style={{ filter: "drop-shadow(0 0 10px var(--primary))" }}>
          <path d="M50 4 C58 22 78 30 76 56 C74 74 62 84 50 84 C38 84 26 74 24 56 C22 40 36 34 40 20 C44 28 46 24 50 4Z" fill="var(--primary)" opacity=".35" />
          <path d="M50 20 C56 32 70 38 68 58 C66 72 58 80 50 80 C42 80 34 72 32 58 C31 46 42 42 44 32 C47 36 48 32 50 20Z" fill="var(--primary-glow)" opacity=".35" />
        </svg>
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
