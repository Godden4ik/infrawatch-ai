"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useReducedMotion, animate } from "motion/react";
import { cn } from "@/lib/utils";

export function AnimatedNumber({
  value,
  duration = 0.35,
  format = (n) => Math.round(n).toString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      previous.current = value;
      setDisplay(value);
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: [0, 0, 0.2, 1],
      onUpdate: (v) => setDisplay(v),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, duration, reduce, motionValue]);

  return (
    <span className={cn("tabular-nums", className)}>{format(display)}</span>
  );
}
