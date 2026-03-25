"use client";

import { motion } from "motion/react";
import { ScenarioButtons } from "./_components/scenario-buttons";
import { InjectForm } from "./_components/inject-form";

export default function AnomalyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <motion.div
        className="space-y-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Anomaly Injection
        </h1>
        <p className="text-muted-foreground">
          Inject failure scenarios into the simulated microservices
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid gap-8 lg:grid-cols-[280px_1fr]"
      >
        <ScenarioButtons />
        <InjectForm />
      </motion.div>
    </div>
  );
}
