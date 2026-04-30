"use server";

import {
  saveProviderKey,
  getProviderKey,
  deleteProviderKey,
  listProviderKeyStatus,
  getMaskedKey,
} from "@/db/provider-keys";
import { safeAction } from "@/services/_shared/safe-action";
import { serverFetch, apiBackendUrl } from "@/services/_shared/fetch-server";
import type { HealthResponse, ProvidersResponse, Provider } from "./schema";

export async function saveKey(providerId: string, apiKey: string) {
  return safeAction(
    async () => {
      saveProviderKey(providerId, apiKey);
      return { success: true };
    },
    { code: "SAVE_KEY_FAILED", message: "Failed to save API key" },
  );
}

export async function removeKey(providerId: string) {
  return safeAction(
    async () => {
      deleteProviderKey(providerId);
      return { success: true };
    },
    { code: "REMOVE_KEY_FAILED", message: "Failed to remove API key" },
  );
}

export async function getKeyStatus() {
  return safeAction(
    async () => {
      return listProviderKeyStatus();
    },
    { code: "KEY_STATUS_FAILED", message: "Failed to get key status" },
  );
}

export async function getMasked(providerId: string) {
  return safeAction(
    async () => {
      return { masked: getMaskedKey(providerId) };
    },
    { code: "GET_MASKED_FAILED", message: "Failed to get masked key" },
  );
}

export async function getRevealed(providerId: string) {
  return safeAction(
    async () => {
      return { key: getProviderKey(providerId) };
    },
    { code: "GET_REVEALED_FAILED", message: "Failed to get provider key" },
  );
}

export async function getHealthyProviders() {
  return safeAction(
    async () => {
      const providersResponse = await serverFetch<ProvidersResponse>(
        apiBackendUrl,
        "/providers/list",
      );

      const healthyProviders = await Promise.all(
        providersResponse.providers.map(async (provider) => {
          const headers: Record<string, string> = {};

          if (provider.requires_key) {
            const key = getProviderKey(provider.id);
            if (!key) {
              return null;
            }
            headers["X-Provider-Key"] = key;
          }

          const health = await serverFetch<HealthResponse>(
            apiBackendUrl,
            `/providers/${provider.id}/health`,
            { headers },
          );

          if (health.status !== "healthy") {
            return null;
          }

          return provider;
        }),
      );

      return {
        providers: healthyProviders.filter(
          (provider): provider is Provider => provider !== null,
        ),
      };
    },
    {
      code: "GET_HEALTHY_PROVIDERS_FAILED",
      message: "Failed to get healthy providers",
    },
  );
}

// Get decrypted key for use in API calls (server-only, never sent to client)
export async function getDecryptedKeyForProvider(
  providerId: string,
): Promise<string | null> {
  return getProviderKey(providerId);
}

export async function checkProviderHealth(providerId: string) {
  return safeAction(
    async () => {
      const key = getProviderKey(providerId);
      const headers: Record<string, string> = {};
      if (key) headers["X-Provider-Key"] = key;

      return serverFetch<HealthResponse>(
        apiBackendUrl,
        `/providers/${providerId}/health`,
        { headers },
      );
    },
    { code: "HEALTH_CHECK_FAILED", message: "Health check failed" },
  );
}
