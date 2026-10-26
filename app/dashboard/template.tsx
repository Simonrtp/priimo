import { Suspense, type ReactNode } from 'react';
import FonduPage from './FonduPage';

export default function Template({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>}>
      <FonduPage>{children}</FonduPage>
    </Suspense>
  );
}
