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
    "DeployX provides a unified deployment management interface. Deployments may be executed using third-party infrastructure providers, including Vercel. Use of third-party infrastructure may be subject to the applicable provider's terms and policies.",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
