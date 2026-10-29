// Archive / restore rules for service guides. Pure functions: no storage, no
// permissions, so the admin service and the tests can share them.
//
// Archiving only sets `archived: true` (plus `archivedAt`) on the record. The
// record and its id are kept, so saved links and saved-guide references keep
// resolving. Restoring clears the flag, but only when the record still has the
// fields the public directory needs.

const REQUIRED_FIELDS = [
  ['name', 'name'],
  ['category', 'category'],
  ['shortDescription', 'short description'],
];

export const isArchived = (svc) => Boolean(svc) && svc.archived === true;

/** Labels of required fields that are missing or blank. Empty array means valid. */
export const missingRequiredFields = (svc) =>
  REQUIRED_FIELDS.filter(([key]) => typeof svc?.[key] !== 'string' || svc[key].trim() === '').map(
    ([, label]) => label
  );

const uniqueIds = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'))];

/**
 * What a bulk archive would do to `selectedIds`, given the current `services`.
 * Ids that no longer exist (stale) are listed, never thrown on.
 */
export const planBulkArchive = (selectedIds, services) => {
  const byId = new Map(services.map((s) => [s.id, s]));
  const plan = { toChange: [], skippedAlreadyArchived: [], unknownIds: [] };
  for (const id of uniqueIds(selectedIds)) {
    const svc = byId.get(id);
    if (!svc) plan.unknownIds.push(id);
    else if (isArchived(svc)) plan.skippedAlreadyArchived.push({ id, name: svc.name });
    else plan.toChange.push({ id, name: svc.name });
  }
  return plan;
};

/** What a bulk restore would do. Records that fail validation stay archived. */
export const planBulkRestore = (selectedIds, services) => {
  const byId = new Map(services.map((s) => [s.id, s]));
  const plan = { toChange: [], skippedNotArchived: [], invalid: [], unknownIds: [] };
  for (const id of uniqueIds(selectedIds)) {
    const svc = byId.get(id);
    if (!svc) {
      plan.unknownIds.push(id);
    } else if (!isArchived(svc)) {
      plan.skippedNotArchived.push({ id, name: svc.name });
    } else {
      const missing = missingRequiredFields(svc);
      if (missing.length) plan.invalid.push({ id, name: svc.name || id, missing });
      else plan.toChange.push({ id, name: svc.name });
    }
  }
  return plan;
};

export const withArchived = (svc, archivedAt) => ({ ...svc, archived: true, archivedAt });

export const withRestored = (svc) => {
  const rest = { ...svc };
  delete rest.archived;
  delete rest.archivedAt;
  return rest;
};

/** One entry per skipped group, for the review summary and the audit log. */
export const describePlan = (plan) => {
  const lines = [];
  if (plan.skippedAlreadyArchived?.length) lines.push(`${plan.skippedAlreadyArchived.length} already archived`);
  if (plan.skippedNotArchived?.length) lines.push(`${plan.skippedNotArchived.length} not archived`);
  if (plan.invalid?.length) lines.push(`${plan.invalid.length} failed validation`);
  if (plan.unknownIds?.length) lines.push(`${plan.unknownIds.length} no longer exist`);
  return lines;
};
