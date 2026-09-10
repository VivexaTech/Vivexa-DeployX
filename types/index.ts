export type SubscriptionStatus =
  | "none"
  | "pending"
  | "authenticated"
  | "active"
  | "past_due"
  | "failed"
  | "cancelled"
  | "expired"
  | "paused"
  | "halted"
  | "completed";

export type ProjectStatus =
  | "creating"
  | "queued"
  | "building"
  | "deploying"
  | "ready"
  | "error"
  | "cancelled";

export type DeploymentStatus =
  | "queued"
  | "building"
  | "ready"
  | "error"
  | "cancelled";

export type DomainStatus = "pending" | "verified" | "error" | "removed";

export type InvoiceStatus = "paid" | "failed" | "refunded" | "pending";

export type NotificationType =
  | "deployment_success"
  | "deployment_failed"
  | "subscription_activated"
  | "payment_failed"
  | "renewal_reminder"
  | "domain_verified"
  | "domain_failed"
  | "system";

export type PlanFeatures = {
  customDomains: boolean;
  githubDeployment: boolean;
  environmentVariables: boolean;
  automaticDeployments: boolean;
  teamMembers: number;
  maxDeploymentsPerMonth: number | null;
  supportLevel: string;
};

export type PricingPlan = {
  id: string;
  planName: string;
  planPrice: number;
  currency: string;
  keyPoints: string[];
  maxWebsites: number;
  duration: string;
  billingCycle: "monthly" | "yearly";
  razorpayPlanId: string;
  active: boolean;
  displayOrder: number;
  features: PlanFeatures;
  gracePeriodDays: number;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  activePlanId: string | null;
  activePlanName: string | null;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate: string | null;
  renewalDate: string | null;
  websiteLimit: number;
  websiteCount: number;
  gracePeriodDays: number;
  createdAt: string;
  updatedAt: string;
};

export type EnvVar = {
  key: string;
  value: string;
};

export type Project = {
  projectId: string;
  userId: string;
  name: string;
  slug: string;
  repository: string;
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  framework: string | null;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  latestDeploymentId: string | null;
  deploymentUrl: string | null;
  platformSubdomain: string | null;
  customDomain: string | null;
  status: ProjectStatus;
  envVarsConfigured: boolean;
  autoDeploy: boolean;
  countsTowardLimit: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Deployment = {
  deploymentId: string;
  projectId: string;
  userId: string;
  vercelDeploymentId: string | null;
  url: string | null;
  inspectorUrl: string | null;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  status: DeploymentStatus;
  readyState: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ProjectDomain = {
  domainId: string;
  projectId: string;
  userId: string;
  domain: string;
  type: "platform" | "custom";
  status: DomainStatus;
  verified: boolean;
  sslReady: boolean;
  verification: unknown;
  recommendedCNAME: string | null;
  recommendedA: string | null;
  recommendedAAAA: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  invoiceId: string;
  invoiceNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  planId: string | null;
  planName: string;
  amount: number;
  currency: string;
  taxAmount: number;
  taxLabel: string | null;
  paymentId: string | null;
  subscriptionId: string | null;
  status: InvoiceStatus;
  paymentDate: string;
  renewalDate: string | null;
  createdAt: string;
};

export type AppNotification = {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type ShowcaseProject = {
  id: string;
  title: string;
  description: string;
  image: string;
  projectUrl: string;
  category?: string;
  featured?: boolean;
  createdAt: string;
};

export type SupportContent = {
  phone: string;
  email: string;
};

export type CompanyContent = {
  name: string;
  platformName: string;
  tagline: string;
  mission: string;
  aboutPlatform: string;
  aboutCompany: string;
  whyExists: string;
};

export type GithubRepo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
};

export type SubscriptionRecord = {
  subscriptionId: string;
  userId: string;
  planId: string;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: SubscriptionStatus;
  startDate: string | null;
  renewalDate: string | null;
  amount: number;
  currency: string;
  reminderSentForRenewal: string | null;
  createdAt: string;
  updatedAt: string;
};
