export type UserRole = "user" | "admin" | "super_admin";
export type AccountStatus = "active" | "suspended";
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";
export type BillingCycle = "free" | "monthly" | "yearly";
export type PaymentStatus = "created" | "paid" | "failed" | "cancelled" | "refunded";
export type DeploymentStatus = "queued" | "building" | "deploying" | "ready" | "error" | "failed" | "cancelled";
export type DomainType = "subdomain" | "custom";
export type DomainStatus = "pending" | "verifying" | "verified" | "invalid";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type DiscountType = "percent" | "fixed";

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string[];
  max_projects: number | null;
  max_deployments_per_month: number | null;
  max_domains: number | null;
  max_team_members: number | null;
  bandwidth_gb: number | null;
  max_builds_per_month: number | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  plan_id: string;
  subscription_id: string | null;
  coupon_id: string | null;
  billing_cycle: BillingCycle;
  order_id: string;
  payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  discount_amount: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  plan_name?: string | null;
  base_amount?: number | null;
  taxable_amount?: number | null;
  tax_type?: InvoiceTaxType | null;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  other_tax_name?: string | null;
  other_tax_rate?: number;
  other_tax_amount?: number;
  billing_snapshot?: Record<string, unknown> | null;
  gst_snapshot?: Record<string, unknown> | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceTaxType = "intra_state" | "inter_state" | "none";

export interface BillingProfile {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  gst_enabled: boolean;
  gstin: string | null;
  gst_legal_name: string | null;
  gst_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  payment_id: string;
  plan_id: string | null;
  plan_name: string;
  billing_cycle: BillingCycle;
  period_start: string | null;
  period_end: string | null;
  currency: string;
  base_amount: number;
  discount_amount: number;
  taxable_amount: number;
  tax_type: InvoiceTaxType;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  other_tax_name: string | null;
  other_tax_rate: number;
  other_tax_amount: number;
  total_amount: number;
  customer_name: string;
  customer_company: string | null;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_state_code: string | null;
  customer_postal_code: string | null;
  customer_country: string | null;
  customer_gstin: string | null;
  customer_gst_legal_name: string | null;
  customer_gst_address: string | null;
  company_name: string;
  company_logo: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_gstin: string | null;
  footer_note: string | null;
  tax_note: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  status: "paid" | "refunded" | "void";
  paid_at: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_redemptions: number | null;
  redeemed_count: number;
  plan_ids: string[] | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GithubConnection {
  id: string;
  user_id: string;
  github_user_id: number;
  username: string;
  avatar_url: string | null;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  repo_owner: string;
  repo_name: string;
  repo_id: number | null;
  repo_private: boolean;
  branch: string;
  framework: string;
  root_directory: string;
  build_command: string | null;
  install_command: string | null;
  output_directory: string | null;
  provider: string;
  provider_project_id: string | null;
  production_url: string | null;
  latest_deployment_status: DeploymentStatus | null;
  last_deployed_at: string | null;
  auto_deploy?: boolean;
  webhook_secret?: string | null;
  production_deployment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string;
  project_id: string;
  user_id: string;
  status: DeploymentStatus;
  target: string;
  branch: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  commit_author: string | null;
  provider: string;
  provider_deployment_id: string | null;
  url: string | null;
  inspector_url: string | null;
  error_message: string | null;
  build_started_at: string | null;
  ready_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeploymentLog {
  id: number;
  deployment_id: string;
  source: string;
  level: string;
  message: string;
  created_at: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  reason?: string;
}

export interface Domain {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  type: DomainType;
  status: DomainStatus;
  ssl_status: string;
  dns_records: DnsRecord[];
  verification: DnsRecord[];
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentVariable {
  id: string;
  project_id: string;
  user_id: string;
  key: string;
  is_secret: boolean;
  targets: string[];
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  is_staff: boolean;
  message: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformSettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
}
