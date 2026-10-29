// src/api/live.ts
import { http } from "./http";
import type { Ok, LiveCategory, LiveChannel } from "./types";

// Categories
type CatList = { ok: boolean; categories?: LiveCategory[]; items?: LiveCategory[]; data?: LiveCategory[]; message?: string; error?: string };
type CatGet = { ok: boolean; category?: LiveCategory; item?: LiveCategory; data?: LiveCategory; message?: string; error?: string };

export async function listCategories(): Promise<LiveCategory[]> {
  const res = await http.get<CatList>("/live/categories");
  if (!res.ok) throw new Error(res.message || res.error || "Failed to load categories");
  return (res.categories || res.items || res.data || []) as LiveCategory[];
}

export async function getCategory(id: number): Promise<LiveCategory> {
  const res = await http.get<CatGet>(`/live/categories/${id}`);
  if (!res.ok) throw new Error(res.message || res.error || "Failed to load category");
  return (res.category || res.item || res.data) as LiveCategory;
}

export async function createCategory(payload: Partial<LiveCategory>): Promise<LiveCategory | Ok> {
  return http.post("/live/categories", payload as any);
}

export async function updateCategory(id: number, payload: Partial<LiveCategory>): Promise<LiveCategory | Ok> {
  return http.put(`/live/categories/${id}`, payload as any);
}

export async function deleteCategory(id: number): Promise<Ok> {
  return http.del<Ok>(`/live/categories/${id}`);
}

// Channels
export type ChannelPaging = {
  limit: number;
  offset: number;
  total: number;
};

export type ChannelListResult = {
  items: LiveChannel[];
  paging: ChannelPaging;
};

type ChList = {
  ok: boolean;
  channels?: LiveChannel[];
  items?: LiveChannel[];
  data?: LiveChannel[];
  paging?: Partial<ChannelPaging>;
  message?: string;
  error?: string;
};
type ChGet = { ok: boolean; channel?: LiveChannel; item?: LiveChannel; data?: LiveChannel; message?: string; error?: string };

export async function listChannels(
  params: { limit?: number; offset?: number } = {}
): Promise<ChannelListResult> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const res = await http.get<ChList>(
    `/live/channels?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`
  );

  if (!res.ok) {
    throw new Error(res.message || res.error || "Failed to load channels");
  }

  const items = (res.channels || res.items || res.data || []) as LiveChannel[];

  return {
    items,
    paging: {
      limit: Number(res.paging?.limit ?? limit),
      offset: Number(res.paging?.offset ?? offset),
      total: Number(res.paging?.total ?? items.length),
    },
  };
}

export async function getChannel(id: number): Promise<LiveChannel> {
  const res = await http.get<ChGet>(`/live/channels/${id}`);
  if (!res.ok) throw new Error(res.message || res.error || "Failed to load channel");
  return (res.channel || res.item || res.data) as LiveChannel;
}

export async function createChannel(payload: Partial<LiveChannel>): Promise<LiveChannel | Ok> {
  return http.post("/live/channels", payload as any);
}

export async function updateChannel(id: number, payload: Partial<LiveChannel>): Promise<LiveChannel | Ok> {
  return http.put(`/live/channels/${id}`, payload as any);
}

export async function deleteChannel(id: number): Promise<Ok> {
  return http.del<Ok>(`/live/channels/${id}`);
}

// Logo upload
export type UploadChannelLogoRes = {
  ok: boolean;
  channel_id?: number;
  logo_file_id?: number;
  logo_uri?: string;
  size?: number;
  message?: string;
  error?: string;
};

export async function uploadChannelLogo(id: number, file: File): Promise<UploadChannelLogoRes> {
  const fd = new FormData();
  fd.append("logo", file);

  const res = await http.request<UploadChannelLogoRes>(`/live/channels/${id}/logo`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(res.message || res.error || "Failed to upload logo");
  return res;
}
