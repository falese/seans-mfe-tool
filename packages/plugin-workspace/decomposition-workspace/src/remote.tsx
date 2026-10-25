/**
 * Remote Entry Point — domain capabilities + the ADR-056 presentation handle.
 * Generated from mfe-manifest.yaml
 */
import { createImperativeHandle, type ImperativeMountHandle } from '@seans-mfe-tool/runtime';
import { mfe, mfeReady } from './platform/base-mfe/bootstrap';
import { ProposalMap } from './features/ProposalMap/ProposalMap';
import { ShapeProposal } from './features/ShapeProposal/ShapeProposal';
import { AgentPane } from './features/AgentPane/AgentPane';
import { ApproveProposal } from './features/ApproveProposal/ApproveProposal';

export { ProposalMap };
export { ShapeProposal };
export { AgentPane };
export { ApproveProposal };

export { mfe, mfeReady };

/**
 * Presentation handle (ADR-056): a host-side Framework Provider composes this
 * MFE through the sealed port — handles.imperative.mount(element, { capability,
 * props }) → unmount. This MFE is multi-capability (ProposalMap, ShapeProposal, AgentPane, ApproveProposal);
 * the host selects one per mount, defaulting to ProposalMap.
 */
export const handles: { imperative: ImperativeMountHandle } = {
  imperative: createImperativeHandle(mfe, {
    framework: 'react',
    mfeReady,
    defaultCapability: 'ProposalMap',
  }),
};

export { default } from './App';
