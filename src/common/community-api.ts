import { getCurrentUser } from './user';
export interface InboxRoom {
  room: string;
  unread: number;
  mentions?: number;
  lastRead?: number;
  muted: boolean;
  sound: boolean;
}
export interface Progression {
  xp: number;
  level: number;
  levelStart: number;
  nextLevel: number;
  results: number;
  badges: string[];
}
export async function communityRequest(
  action: string,
  payload: unknown = {},
): Promise<any> {
  const email = getCurrentUser()?.email;
  if (!email) return { ok: false, error: 'Je CASPR-account kon niet worden gevonden.' };
  return chrome.runtime.sendMessage({
    type: 'community:feature',
    action,
    email,
    payload,
  });
}
