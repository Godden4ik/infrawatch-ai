const PREFIX = "provider-key:";

export function getStoredKey(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}${providerId}`);
}

export function storeKey(providerId: string, key: string): void {
  sessionStorage.setItem(`${PREFIX}${providerId}`, key);
}

export function clearKey(providerId: string): void {
  sessionStorage.removeItem(`${PREFIX}${providerId}`);
}
