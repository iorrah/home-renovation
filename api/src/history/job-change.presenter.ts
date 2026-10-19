import { describeDiff, formatValue } from './describe-change.js';
import type { JobChange } from './job-change.entity.js';
import type { JobChangeModel } from './job-change.model.js';

/** Turns a stored history row into its API shape. Expects responsibleUser to be loaded. */
export function toJobChangeModel(change: JobChange): JobChangeModel {
  return {
    id: change.id,
    changeNumber: change.changeNumber,
    type: change.type,
    state: change.state,
    changes: Object.entries(change.diff).map(([field, { from, to }]) => ({
      field,
      from: formatValue(field, from),
      to: formatValue(field, to),
    })),
    summary: describeDiff(change.diff),
    responsibleUser: change.responsibleUser,
    targetChangeId: change.targetChangeId,
    createdAt: change.createdAt,
  };
}
