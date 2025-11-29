/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 * 
 * Generated from mfe-manifest.yaml
 */

import React from 'react';

// Feature imports
import { DataAnalysis } from './features/DataAnalysis';
import { ReportViewer } from './features/ReportViewer';
import { DataAnalysisDetailed } from './features/DataAnalysisDetailed';

// Re-export features for Module Federation consumption
export { DataAnalysis };
export { ReportViewer };
export { DataAnalysisDetailed };

// Default export for standalone rendering
export { default } from './App';
