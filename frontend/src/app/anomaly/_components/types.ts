"use client";

export type InjectionSource = "manual" | "scenario";

export type InjectionEvent =
  | {
      id: string;
      kind: "inject";
      service: string;
      anomalyType: string;
      source: InjectionSource;
      scenario?: string;
      status: string;
      timestamp: number;
    }
  | {
      id: string;
      kind: "reset";
      source: "system";
      status: "reset";
      timestamp: number;
    };

export type ActiveInjection = Extract<InjectionEvent, { kind: "inject" }>;

export type InjectResponse = {
  service?: string;
  anomaly_type?: string;
  status?: string;
  message?: string;
  error?: string;
};

export type ScenarioResponse = {
  scenario?: string;
  results?: InjectResponse[];
  error?: string;
};

export type ResetResponse = {
  status?: string;
  error?: string;
};
