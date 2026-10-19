export const siteConfig = {
  name: "Vivexa DeployX",
  shortName: "DeployX",
  company: "Vivexa Tech",
  tagline: "Deploy. Manage. Scale.",
  description:
    "Connect GitHub, deploy your applications, manage domains, and monitor deployments from one powerful dashboard.",
  url: (process.env.NEXT_PUBLIC_APP_URL || "https://deployx.vivexatech.in").replace(/\/$/, ""),
  supportEmail: "support@vivexatech.in",
  infrastructureDisclosure:
    "DeployX provides a unified, production-ready cloud deployment platform. Deployments are orchestrated and executed on high-performance cloud infrastructure with automated monitoring and global edge delivery.",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
