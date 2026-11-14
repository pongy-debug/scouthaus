// Runtime switches for Scouthaus. Change them with env vars (e.g. in Lovable's settings or .env.local), not in code.

/**
 * Where property photos come from:
 *  - "agent":      photo URLs saved from the original advert (hot-linked, never downloaded or re-hosted)
 *  - "streetview": reserved for a street-level image source; not implemented yet, so it shows the placeholder
 *  - "none":       no photo areas at all
 * Set VITE_IMAGE_SOURCE to switch.
 */
export type ImageSource = "agent" | "streetview" | "none";
const raw = (import.meta.env["VITE_IMAGE_SOURCE"] as string | undefined)?.toLowerCase();
export const IMAGE_SOURCE: ImageSource = raw === "streetview" || raw === "none" ? raw : "agent";
