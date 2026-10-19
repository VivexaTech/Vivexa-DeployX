export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Vivexa DeployX?",
    a: "DeployX is a deployment management platform by Vivexa Tech. Connect GitHub, deploy your applications, manage domains and monitor deployments from one dashboard.",
  },
  {
    q: "How does the Vivexa DeployX hosting infrastructure work?",
    a: "DeployX delivers enterprise-grade cloud hosting and edge deployment capabilities with automated build pipelines, global CDN routing, automated SSL certificates, and real-time monitoring.",
  },
  {
    q: "Which frameworks are supported?",
    a: "Next.js, React, Vite, Vue, Nuxt, Astro and static HTML are detected automatically. Other frameworks can be configured manually with custom build and output settings.",
  },
  {
    q: "How does billing work?",
    a: "Paid plans are prepaid monthly or yearly through Razorpay and activate only after server-side payment verification. Plans don't auto-renew; you can renew or change plans from Billing.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes. Add a custom domain, configure the DNS records shown in the dashboard, and verify. Every project can also use a DeployX subdomain.",
  },
  {
    q: "How are my secrets protected?",
    a: "GitHub tokens and environment variable values are encrypted with AES-256-GCM before storage, are only decrypted on our servers, and are redacted from build logs.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan lets you deploy a personal project with a DeployX subdomain. Plan limits are shown on the pricing page.",
  },
  {
    q: "How do I get support?",
    a: "Open a ticket from Dashboard → Support. Paid plans receive faster response times.",
  },
];
