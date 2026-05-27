"use client";

import { Children, isValidElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";
import { cn } from "@/lib/utils";

export function PageMount({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div key={i} variants={fadeInUp}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
