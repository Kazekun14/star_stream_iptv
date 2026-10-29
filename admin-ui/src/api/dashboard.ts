// src/api/dashboard.ts
import { http } from "./http";

export type PackageMetric = {
  package_id: number;
  package_name: string;
  users_count: number;
  channels_count: number;
  categories_count: number;
};

export type CategoryMetric = {
  category_id: number;
  category_name: string;
  channels_count: number;
};

export type DashboardMetrics = {
  generated_at: string;

  users_total: number;
  users_active: number;
  users_disabled: number;
  users_suspended: number;
  users_trial: number;

  packages_total: number;
  channels_total: number;
  categories_total: number;

  users_by_package: PackageMetric[];
  channels_by_category?: CategoryMetric[];
};

type DashboardMetricsResponse = {
  ok: boolean;
  metrics: DashboardMetrics;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Option A: if http.get is generic:
  // const res = await http.get<DashboardMetricsResponse>("/dashboard/metrics");

  // Option B: cast (works even if http.get returns unknown):
  const res = (await http.get("/dashboard/metrics")) as DashboardMetricsResponse;

  if (!res || res.ok !== true || !res.metrics) {
    throw new Error("Invalid /dashboard/metrics response");
  }
  return res.metrics;
}
