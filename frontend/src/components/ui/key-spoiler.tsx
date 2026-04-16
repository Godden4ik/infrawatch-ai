"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ParticleManager } from "@/lib/particle-manager";
import { cn } from "@/lib/utils";

interface KeySpoilerProps {
  children: React.ReactNode;
  /** Controlled reveal state. When false the particle overlay is shown. */
  revealed?: boolean;
  /** Called when the user clicks to toggle reveal (uncontrolled usage). */
  onReveal?: () => void;
  className?: string;
}

/**
 * Wraps a masked API key string in a Telegram-style particle noise overlay.
 * Clicking reveals (or re-hides) the key.
 *
 * Usage (uncontrolled):
 *   <KeySpoiler>sk-a1b2...z9y0</KeySpoiler>
 *
 * Usage (controlled):
 *   <KeySpoiler revealed={isRevealed} onReveal={() => setRevealed(v => !v)}>
 *     sk-a1b2...z9y0
 *   </KeySpoiler>
 */
export function KeySpoiler({ children, revealed: revealedProp, onReveal, className }: KeySpoilerProps) {
  const [internalRevealed, setInternalRevealed] = useState(false);
  const isControlled = revealedProp !== undefined;
  const revealed = isControlled ? revealedProp : internalRevealed;

  const containerRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<ParticleManager | null>(null);
  const rafRef = useRef<number | null>(null);
  const colorRef = useRef<string>("#888888");

  // Resolve --muted-foreground CSS variable to a concrete colour for the canvas
  const resolveColor = useCallback(() => {
    if (typeof window === "undefined") return;
    const style = getComputedStyle(document.documentElement);
    // CSS var returns something like "oklch(0.705 0.015 286.067)" — canvas needs hex/rgb.
    // We sample it via an offscreen element painted with that colour.
    const tmp = document.createElement("canvas");
    tmp.width = 1; tmp.height = 1;
    const ctx = tmp.getContext("2d");
    if (!ctx) return;
    // Use a known safe fallback colour close to muted-foreground in dark mode
    const raw = style.getPropertyValue("--muted-foreground").trim();
    // If it's an oklch value, approximate with a grey that matches the dark-mode muted tone
    if (raw.startsWith("oklch")) {
      colorRef.current = "rgba(140,140,160,1)";
    } else {
      colorRef.current = raw || "rgba(140,140,160,1)";
    }
  }, []);

  const startAnimation = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    resolveColor();

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;

    managerRef.current = new ParticleManager(w, h, {
      density: 12,         // higher than Telegram default — keys are short
      minVelocity: 0.15,
      maxVelocity: 0.45,
      particleLifetime: 55, // faster lifecycle
      scale: 0.9,          // smaller particles
      textColor: colorRef.current,
    });

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      managerRef.current?.update();
      managerRef.current?.draw(ctx);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [resolveColor]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    managerRef.current?.clear();
    managerRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (revealed) {
      stopAnimation();
    } else {
      startAnimation();
    }
    return () => stopAnimation();
  }, [revealed, startAnimation, stopAnimation]);

  const handleClick = () => {
    if (isControlled) {
      onReveal?.();
    } else {
      setInternalRevealed((v) => !v);
    }
  };

  return (
    <span
      ref={containerRef}
      onClick={handleClick}
      title={revealed ? "Click to hide" : "Click to reveal"}
      className={cn(
        "relative inline-flex cursor-pointer select-none items-center rounded-sm",
        className,
      )}
    >
      {/* Actual key text — always rendered for layout, opacity controls visibility */}
      <span
        className={cn(
          "font-mono text-xs transition-opacity duration-200",
          revealed ? "opacity-100 text-foreground" : "opacity-30 text-muted-foreground",
        )}
      >
        {children}
      </span>

      {/* Particle canvas overlay — only visible when not revealed */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-200",
          revealed ? "opacity-0" : "opacity-100",
        )}
        style={{ display: "block" }}
      />
    </span>
  );
}
