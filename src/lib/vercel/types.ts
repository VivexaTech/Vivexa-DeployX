export type VercelReadyState = "QUEUED" | "BUILDING" | "INITIALIZING" | "READY" | "ERROR" | "CANCELED";

export type VercelProject = {
  id: string;
  name: string;
  framework: string | null;
};

export type VercelDeployment = {
  id: string;
  url: string;
  name: string;
  readyState: VercelReadyState;
  alias?: string[];
  aliasAssigned?: boolean | number | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  inspectorUrl?: string | null;
  createdAt?: number;
  buildingAt?: number;
  ready?: number;
  target?: string | null;
  meta?: Record<string, string>;
};

export type VercelFileRef = { file: string; sha: string; size: number };

export type VercelVerification = { type: string; domain: string; value: string; reason: string };

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: VercelVerification[];
};

export type VercelDomainConfig = {
  configuredBy: "A" | "CNAME" | "dns-01" | "http" | null;
  misconfigured: boolean;
  acceptedChallenges?: string[];
  recommendedCNAME?: { rank: number; value: string }[];
  recommendedIPv4?: { rank: number; value: string[] }[];
};

export type VercelEvent = {
  type: string;
  created: number;
  text?: string;
  level?: string;
  payload?: { text?: string };
};

export type VercelEnvTarget = "production" | "preview" | "development";
