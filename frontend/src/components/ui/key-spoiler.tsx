"use client";

import { useEffect, useRef, useState } from "react";
import { ParticleManager } from "@/lib/particle-manager";
import { cn } from "@/lib/utils";

const REVEAL_MS = 800;

interface KeySpoilerProps {
  children: React.ReactNode;
  revealed?: boolean;
  onReveal?: () => void;
  className?: string;
}

export function KeySpoiler({
  children,
  revealed: revealedProp,
  onReveal,
  className,
}: KeySpoilerProps) {
  const isControlled = revealedProp !== undefined;
  const [revealedState, setRevealedState] = useState(false);
  const revealed = isControlled ? revealedProp : revealedState;
  const [animating, setAnimating] = useState(false);

  const containerRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<ParticleManager | null>(null);
  const rafRef = useRef<number | null>(null);

  // Start particles once on mount, keep running until unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Resolve particle color from computed style
    const computedColor = getComputedStyle(container).color || "rgba(140,140,160,1)";

    managerRef.current = new ParticleManager(w, h, {
      density: 12,
      minVelocity: 0.15,
      maxVelocity: 0.45,
      particleLifetime: 55,
      scale: 0.9,
      textColor: computedColor,
    });

    function loop() {
      if (!managerRef.current) return;
      ctx!.clearRect(0, 0, w, h);
      managerRef.current.update();
      managerRef.current.draw(ctx!);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      managerRef.current?.clear();
      managerRef.current = null;
    };
  }, []);

  function handleClick() {
    if (isControlled) {
      setAnimating(true);
      onReveal?.();
    } else {
      setAnimating(true);
      setRevealedState((v) => !v);
    }
  }

  const duration = `${REVEAL_MS}ms`;

  return (
    <span
      ref={containerRef}
      data-revealed={revealed || undefined}
      onClick={handleClick}
      title={revealed ? "Click to hide" : "Click to reveal"}
      className={cn(
        "relative flex w-full min-w-0 cursor-pointer select-none items-center",
        revealed ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {/* Text — transparent when hidden, clip-path reveals from center */}
      <span
        className={cn(
          "block min-w-0 flex-1 font-mono text-xs",
          revealed
            ? "overflow-x-auto whitespace-nowrap text-left [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            : "overflow-hidden text-ellipsis whitespace-nowrap",
        )}
        style={{
          color: revealed ? undefined : "transparent",
          clipPath: revealed ? "inset(0 0)" : "inset(0 50%)",
          transition: animating
            ? `color ${duration} ease-out, clip-path ${duration} cubic-bezier(0.25, 1, 0.5, 1)`
            : "none",
        }}
        onTransitionEnd={() => setAnimating(false)}
      >
        {children}
      </span>

      {/* Particle canvas — fades out on reveal */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: revealed ? 0 : 1,
          transition: animating ? `opacity ${duration} ease-out` : "none",
        }}
      />
    </span>
  );
}
