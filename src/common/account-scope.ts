import { getCurrentUser } from './user';

export function accountScope(): string {
  return getCurrentUser()?.email || '';
}
