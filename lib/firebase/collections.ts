export const collections = {
  users: "users",
  projects: "projects",
  deployments: "deployments",
  domains: "domains",
  invoices: "invoices",
  notifications: "notifications",
  subscriptions: "subscriptions",
  payments: "payments",
  webhookEvents: "webhookEvents",
  renewalReminders: "renewalReminders",
  githubConnections: "githubConnections",
  rateLimits: "rateLimits",
  subdomainIndex: "subdomainIndex",
  domainIndex: "domainIndex",
  about: "about",
} as const;

export const aboutDocs = {
  support: "support",
  company: "company",
  reservedSubdomains: "reservedSubdomains",
} as const;

export function userRef(uid: string) {
  return `${collections.users}/${uid}`;
}

export function userProjectsPath(uid: string) {
  return `${collections.users}/${uid}/${collections.projects}`;
}

export function userProjectPath(uid: string, projectId: string) {
  return `${collections.users}/${uid}/${collections.projects}/${projectId}`;
}

export function userDeploymentsPath(uid: string, projectId: string) {
  return `${userProjectPath(uid, projectId)}/${collections.deployments}`;
}

export function userDomainsPath(uid: string, projectId: string) {
  return `${userProjectPath(uid, projectId)}/${collections.domains}`;
}

export function userInvoicesPath(uid: string) {
  return `${collections.users}/${uid}/${collections.invoices}`;
}

export function userNotificationsPath(uid: string) {
  return `${collections.users}/${uid}/${collections.notifications}`;
}

export function pricingPlansPath() {
  return `${collections.about}/pricing/plans`;
}

export function showcaseProjectsPath() {
  return `${collections.about}/content/projects`;
}
