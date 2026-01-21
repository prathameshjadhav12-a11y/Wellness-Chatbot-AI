
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface MapSource {
  title: string;
  uri: string;
  address?: string;
}

export interface AnalysisResult {
  content: string;
  confidence: {
    score: number;
    label: string;
  };
  language: string;
  sources: GroundingSource[];
}

export interface DoctorSearchResult {
  content: string;
  mapSources: MapSource[];
}

export interface Vitals {
  temp: string;
  hr: string;
  bpSys: string;
  bpDia: string;
  spo2: string;
}

export interface HistoryItem {
  id: string;
  symptoms: string;
  timestamp: number;
  result: AnalysisResult;
  vitals?: Vitals; // Added for trend analysis
}

export interface LocalAnalysis {
  condition: string;
  severity: 'normal' | 'warning' | 'critical';
  message: string;
}

export interface TrendInsight {
  metric: string;
  change: string; // e.g., "+10%", "-5%"
  direction: 'up' | 'down' | 'stable';
  message: string;
}
