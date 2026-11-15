import { ILead, LeadStatus } from '../models/Lead.js';
import { getSystemSettings } from '../models/SystemSettings.js';

export async function resetAssignmentSla(lead: ILead): Promise<void> {
  const settings = await getSystemSettings();
  const now = new Date();
  lead.slaContactDeadline = undefined;
  if (!lead.firstContactedAt && !lead.contactConfirmedAt) {
    lead.acknowledgedAt = undefined;
    lead.contactConfirmedAt = undefined;
    lead.slaAcknowledgeDeadline = lead.assignedEngineerId ? new Date(now.getTime() + settings.slaAcknowledgeMinutes * 60000) : undefined;
    lead.slaTimeoutAt = lead.assignedEngineerId ? new Date(now.getTime() + settings.slaTimeoutMinutes * 60000) : undefined;
  } else {
    lead.slaAcknowledgeDeadline = undefined;
    lead.slaTimeoutAt = undefined;
  }
}
