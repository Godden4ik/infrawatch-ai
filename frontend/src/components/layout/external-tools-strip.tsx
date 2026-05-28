"use client";

import { useExternalServices } from "@/lib/external-services-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ExternalToolsStrip() {
  const services = useExternalServices();
  return (
    <div className="flex items-center gap-1 border-l border-border/60 pl-3">
      {services.map((svc) => {
        const Icon = svc.icon;
        return (
          <Tooltip key={svc.id}>
            <TooltipTrigger
              render={
                <a
                  href={svc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${svc.label}`}
                  className="inline-flex h-7 items-center justify-center border border-border/60 bg-card px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              }
            />
            <TooltipContent>
              <span className="font-mono text-[11px]">{svc.label}</span>
              <span className="text-[10px] opacity-70">{svc.description}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
