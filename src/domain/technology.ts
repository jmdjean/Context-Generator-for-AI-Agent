export type TechnologyConfidence = 'high' | 'medium' | 'low';

export interface TechnologyProfile {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  tooling: string[];
  confidence: TechnologyConfidence;
}
