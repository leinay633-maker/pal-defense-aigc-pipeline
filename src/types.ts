export type PipelineStatus = 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'UNKNOWN';

export type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'retry';

export interface PipelineAsset {
  id: string;
  asset: string;
  displayName: string;
  theme: 'forest' | 'snow' | 'volcano' | 'base';
  category: string;
  status: PipelineStatus;
  consumedCredits: number;
  prompt: string;
  textToImageTask?: string;
  imageTo3dTask?: string;
  conceptUrl?: string;
  previewUrl?: string;
  sourceDir: string;
  hasFbx: boolean;
  hasGlb: boolean;
  hasMaterial: boolean;
  generatedAt: string;
}

export interface PipelineSummary {
  totalAssets: number;
  succeededAssets: number;
  failedAssets: number;
  totalCredits: number;
  averageCredits: number;
  byTheme: Record<string, number>;
  generatedAt: string;
}
