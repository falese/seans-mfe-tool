/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 * Generated from mfe-manifest.yaml
 */

import React from 'react';
import { DataAnalysis } from './features/DataAnalysis/DataAnalysis.tsx';
import { ReportViewer } from './features/ReportViewer/ReportViewer.tsx';
import { DataAnalysisDetailed } from './features/DataAnalysisDetailed/DataAnalysisDetailed.tsx';

export { DataAnalysis };
export { ReportViewer };
export { DataAnalysisDetailed };

export { default } from './App.tsx';
