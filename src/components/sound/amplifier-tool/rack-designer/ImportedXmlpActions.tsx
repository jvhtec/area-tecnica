import type { ImportedLaSession } from './importedLaSession';
import { SoundvisionFlysheetButton } from './SoundvisionFlysheetButton';

interface ImportedXmlpActionsProps {
  session: ImportedLaSession | null;
  createdBy?: string;
}

export function ImportedXmlpActions({
  session,
  createdBy,
}: ImportedXmlpActionsProps) {
  return <SoundvisionFlysheetButton session={session} createdBy={createdBy} />;
}
