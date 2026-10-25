/** A named edit (ADR-110 §4) in words a product owner reads. */

import type { Edit } from './types';

const base = (f: string) => f.split('/').pop() ?? f;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function describeEdit(e: Edit): string {
  switch (e.kind) {
    case 'rename-domain':
      return `Rename ${e.from} to ${e.to}`;
    case 'merge-domains':
      return `Merge ${list(e.domains ?? [])} into ${e.into}`;
    case 'split-domain':
      return `Split ${(e.files ?? []).map(base).join(', ')} out of ${e.domain} into ${e.into}`;
    case 'move-file':
      return `Move ${base(e.file ?? '')} to ${e.to}`;
    case 'rename-capability':
      return `Rename the ${e.from} screen to ${e.to}`;
    case 'rename-slot':
      return `Rename the ${e.from} area to ${e.to}`;
    case 'comment':
      return e.about ? `Comment on ${e.about}: “${e.text}”` : `Comment: “${e.text}”`;
    case 'suggest':
      return e.edit ? `Suggest: ${describeEdit(e.edit)}` : 'Suggest an edit';
    case 'accept-suggestion':
      return `Accept suggestion ${e.id}`;
    case 'reject-suggestion':
      return `Reject suggestion ${e.id}`;
    case 'approve':
      return 'Approve the proposal';
  }
}
