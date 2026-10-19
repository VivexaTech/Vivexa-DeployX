/**
 * Default legal texts. Administrators can override each document from
 * Admin → Settings (stored in platform_settings as legal_*). Format: blank-line
 * separated paragraphs, "## " for headings and "- " for list items.
 *
 * These drafts are templates, not legal advice. Items in [BRACKETS] must be
 * completed and the documents reviewed by qualified counsel before launch.
 */
export type LegalKey = "terms" | "privacy" | "acceptable_use" | "refund" | "infrastructure";

export type LegalSettingKey = "legal_terms" | "legal_privacy" | "legal_acceptable_use" | "legal_refund" | "legal_infrastructure";

export const LEGAL_META: Record<LegalKey, { title: string; path: string; settingKey: LegalSettingKey }> = {
  terms: { title: "Terms & Conditions", path: "/terms", settingKey: "legal_terms" },
  privacy: { title: "Privacy Policy", path: "/privacy", settingKey: "legal_privacy" },
  acceptable_use: { title: "Acceptable Use Policy", path: "/acceptable-use", settingKey: "legal_acceptable_use" },
  refund: { title: "Refund Policy", path: "/refund-policy", settingKey: "legal_refund" },
  infrastructure: { title: "Infrastructure Disclosure", path: "/infrastructure", settingKey: "legal_infrastructure" },
};

const OPERATOR = `Vivexa DeployX ("DeployX", "we", "us") is operated by Vivexa Tech [LEGAL ENTITY NAME, REGISTERED ADDRESS, REGISTRATION NUMBER].`;

const DISCLOSURE =
  "Vivexa DeployX provides a unified, production-grade cloud deployment management interface. Deployments are orchestrated and executed on high-performance cloud infrastructure designed for maximum availability and speed.";

export const LEGAL_DEFAULTS: Record<LegalKey, string> = {
  terms: `${OPERATOR} By creating an account or using the service you agree to these Terms & Conditions.

## 1. The service
DeployX lets you connect source code repositories, configure and trigger deployments, manage domains and monitor deployments through a single dashboard.

${DISCLOSURE}

## 2. Cloud infrastructure
DeployX utilizes enterprise cloud infrastructure partners for automated build pipelines, hosting, global CDN routing, and domain management. DeployX provides direct orchestration, monitoring, and project controls. Your deployed content must comply with standard acceptable use policies and applicable laws.

## 3. Your account
- You must provide accurate information and keep your credentials secure.
- You are responsible for all activity under your account.
- You must be legally able to enter into this agreement.

## 4. Your content and responsibilities
You retain ownership of your code and content. You are solely responsible for the content you deploy and for complying with all applicable laws and provider policies. You grant us the limited rights needed to fetch, build, deploy and serve your content on your behalf.

## 5. Prohibited use
Abuse, malware, phishing, illegal content, infringement of third-party rights and any activity described in our Acceptable Use Policy are not allowed. We may suspend or terminate accounts that violate these terms.

## 6. Plans, payments and limits
Paid plans are prepaid for the selected billing period and processed by Razorpay. Plan limits are enforced by the service. Prices may change for future billing periods. Refunds are governed by the Refund Policy.

## 7. Availability
We aim to keep the service available but do not guarantee uninterrupted operation. Availability of deployments also depends on third-party infrastructure providers.

## 8. Limitation of liability
To the maximum extent permitted by law, DeployX and Vivexa Tech are not liable for indirect, incidental or consequential damages, or for losses caused by third-party providers. [LIABILITY CAP TO BE CONFIRMED BY COUNSEL]

## 9. Termination
You may stop using the service at any time. We may suspend or terminate access for violations of these terms or where required by law or by an infrastructure provider.

## 10. Governing law
These terms are governed by the laws of [JURISDICTION], and courts at [CITY] shall have exclusive jurisdiction.

## 11. Contact
[CONTACT EMAIL / POSTAL ADDRESS]`,

  privacy: `${OPERATOR} This Privacy Policy explains what we collect and how we use it.

## Information we collect
- Account data: name, email address, avatar and authentication data (managed by Supabase).
- GitHub data: your GitHub username, profile id and an encrypted OAuth access token used to list repositories and fetch source code.
- Project data: repository names, build settings, deployment metadata, logs and domain names.
- Billing data: plan, amount, order and payment identifiers from Razorpay. We do not store card or bank details.
- Technical data: IP address and request metadata for security and rate limiting.

## How we use information
To provide and secure the service, execute deployments, process payments, provide support, and comply with legal obligations.

## Third-party processors
- Supabase — authentication and database hosting.
- Cloud infrastructure providers — hosting and build pipelines; your source code and build output are processed to build and serve your applications.
- GitHub — repository access you authorize.
- Razorpay — payment processing.

${DISCLOSURE}

## Security
Secrets such as GitHub tokens and environment variable values are encrypted at rest with AES-256-GCM and are only decrypted server-side.

## Retention
We keep account data while your account is active and as required by law. [RETENTION PERIODS TO BE CONFIRMED]

## Your choices
You can update your profile, disconnect GitHub, and request account deletion by contacting support. [DATA PROTECTION CONTACT]`,

  acceptable_use: `This Acceptable Use Policy applies to everything deployed or managed through DeployX. It supplements the policies of our cloud infrastructure providers, which also apply to your deployments.

## You must not use DeployX to
- Distribute malware, ransomware, spyware or other malicious code.
- Host phishing, fraud, scams or deceptive content.
- Host or distribute illegal content, including child sexual abuse material.
- Infringe intellectual property or privacy rights.
- Send spam or operate open proxies, crypto-miners or botnets.
- Attack, scan or disrupt other systems or networks.
- Circumvent plan limits, rate limits or security controls.

## Enforcement
We may remove content, disable deployments, or suspend accounts that violate this policy, and may report illegal activity to authorities. Infrastructure providers may also take independent action under their own policies.

## Reporting abuse
Report abuse to [ABUSE CONTACT EMAIL].`,

  refund: `This Refund Policy applies to paid DeployX plans purchased through Razorpay.

## Prepaid plans
Plans are prepaid for a monthly or yearly period and do not renew automatically.

## Eligibility
[REFUND WINDOW AND CONDITIONS TO BE DEFINED — e.g. requests within N days of purchase for unused plans.]

## How to request
Open a support ticket with your order id. Approved refunds are processed to the original payment method through Razorpay; timelines depend on your bank.

## Non-refundable cases
Accounts suspended for violating the Terms or Acceptable Use Policy are not eligible for refunds.

Refunds are processed manually by our team; DeployX does not issue automatic refunds.`,

  infrastructure: `${DISCLOSURE}

## Who does what
- Vivexa Tech operates DeployX: the dashboard, account management, billing, project configuration and automated orchestration.
- Cloud infrastructure partners provide the underlying compute, build pipelines, and global edge network delivery.
- GitHub provides source code hosting that you connect.
- Supabase provides authentication and database services for DeployX.
- Razorpay processes payments.

## What this means for you
- Availability and performance of deployments are monitored 24/7.
- DeployX orchestrates and secures your builds, domains, and environment configurations.
- Enterprise-grade reliability and automated SSL are provided out of the box.

## Questions
Contact [CONTACT EMAIL] with questions about how your deployments are hosted.`,
};
