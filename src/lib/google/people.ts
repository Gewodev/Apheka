import { apiFetch } from './index';

interface PersonProfile {
  names: { displayName: string; givenName: string; familyName: string }[];
  photos: { url: string; default: boolean }[];
  emailAddresses: { value: string; type: string }[];
}

export interface UserProfile {
  displayName: string;
  givenName: string;
  photoUrl: string;
  email: string;
}

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch<PersonProfile>(
      '/v1/people/me?personFields=names,photos,emailAddresses',
    );
    return {
      displayName: res.names?.[0]?.displayName || '',
      givenName: res.names?.[0]?.givenName || '',
      photoUrl: res.photos?.find(p => p.default)?.url || '',
      email: res.emailAddresses?.[0]?.value || '',
    };
  } catch {
    return null;
  }
}
