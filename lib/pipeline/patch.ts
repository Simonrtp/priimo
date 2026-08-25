export type LeadPipelinePatch = {
  stageId?: string | null;
  stagePosition?: number | null;
  stageChangedAt?: string;
  lostReason?: string | null;
  assignedTo?: string | null;
  takenAt?: string | null;
};

export async function patchLeadPipeline(leadId: string, patch: LeadPipelinePatch): Promise<void> {
  const res = await fetch(`/api/dashboard/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Enregistrement impossible');
  }
}
