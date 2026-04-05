import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

// In-memory fallback for local dev (no KV configured)
const memStore = new Map();
const memIndex = [];

function useMemory() {
  return !process.env.KV_REST_API_URL;
}

export async function saveOffer(data) {
  const id = nanoid(9);
  const offer = {
    id,
    creatorName: data.formData?.creator_name || 'Unknown',
    niche: data.formData?.niche || '',
    primaryPlatform: data.formData?.primary_platform || 'Instagram',
    language: data.formData?.language || 'English',
    formData: data.formData,
    rawOutput: data.rawOutput,
    parsed: data.parsed,
    scraped: data.scraped,
    createdAt: new Date().toISOString(),
  };

  if (useMemory()) {
    memStore.set(`offer:${id}`, JSON.stringify(offer));
    memIndex.unshift({ id, creatorName: offer.creatorName, niche: offer.niche, primaryPlatform: offer.primaryPlatform, createdAt: offer.createdAt });
  } else {
    await kv.set(`offer:${id}`, JSON.stringify(offer));
    await kv.zadd('offers:index', { score: Date.now(), member: JSON.stringify({ id, creatorName: offer.creatorName, niche: offer.niche, primaryPlatform: offer.primaryPlatform, createdAt: offer.createdAt }) });
  }
  return { id };
}

export async function getOffer(id) {
  if (useMemory()) {
    const raw = memStore.get(`offer:${id}`);
    return raw ? JSON.parse(raw) : null;
  }
  const raw = await kv.get(`offer:${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function listOffers() {
  if (useMemory()) {
    return memIndex;
  }
  const members = await kv.zrange('offers:index', 0, -1, { rev: true });
  return members.map(m => typeof m === 'string' ? JSON.parse(m) : m);
}
