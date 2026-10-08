'use client';

// TEMPORAIRE — aperçu du menu « Nouveau ». À supprimer.
import { UserContext, type UserContextValue } from '@/lib/hooks/useUser';
import DeviceProvider from '@/components/dashboard/device/DeviceProvider';
import VoiceCaptureProvider from '@/components/dashboard/voice/VoiceCaptureProvider';
import CreateMenu from '@/components/dashboard/create/CreateMenu';

const FAUX = {
  user: { id: 'u', email: 'x@y.z' },
  profile: { id: 'u', first_name: 'Simon', last_name: 'Ropiot', role: 'directeur' },
  agency: { id: 'a', name: 'Agence' },
  memberships: [],
  isDirector: true,
  isCollaborator: false,
  hasMultipleAgencies: false,
} as unknown as UserContextValue;

export default function ApercuMenu() {
  return (
    <UserContext.Provider value={FAUX}>
      <DeviceProvider device="desktop">
        <VoiceCaptureProvider>
          <div className="flex min-h-dvh justify-end bg-[#1A2A56] p-4 pr-24">
            <CreateMenu />
          </div>
        </VoiceCaptureProvider>
      </DeviceProvider>
    </UserContext.Provider>
  );
}
