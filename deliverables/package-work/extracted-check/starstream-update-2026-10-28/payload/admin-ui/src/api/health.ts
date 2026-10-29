import { http } from "./http";
import type { Health } from "./types";

export function health(): Promise<Health> {
  return http.get<Health>("/health");
}
