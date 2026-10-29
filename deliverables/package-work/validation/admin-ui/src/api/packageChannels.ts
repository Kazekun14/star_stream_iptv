import { http } from "./http";

export type PackageChannel = {
  package_id: number;
  channel_id: number;
  channel_key: string;
  number: number;
  name: string;
  category_id?: number | null;
  enabled: number | boolean;
};

type ListRes = { ok: boolean; items?: PackageChannel[]; data?: PackageChannel[] };

export async function listPackageChannels(packageId: number): Promise<PackageChannel[]> {
  const res = await http.get<ListRes>(`/live/packages/${packageId}/channels`);
  if (!res.ok) throw new Error("Failed to load package channels");
  return res.items || res.data || [];
}

export async function updatePackageChannels(packageId: number, channelIds: number[]) {
  return http.put(`/live/packages/${packageId}/channels`, {
    channel_ids: channelIds,
  });
}
