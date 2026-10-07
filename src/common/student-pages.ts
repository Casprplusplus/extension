export type StudentPage = string;

export function studentPage(pathname: string): StudentPage | undefined {
  const parts = pathname.toLowerCase().split('/').filter(Boolean);

  if (['auth', 'signin-oidc', 'signout-callback-oidc'].includes(parts[0]))
    return undefined;

  if (!parts.length || (parts[0] === 'leerlingapp' && !parts[1])) return 'dashboard';

  return parts[0] === 'leerlingapp' ? parts[1] : parts.slice(0, 2).join('-');
}
