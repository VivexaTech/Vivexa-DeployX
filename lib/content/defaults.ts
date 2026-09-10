import { COMPANY_NAME, PLATFORM_NAME } from "@/config/constants";
import type { CompanyContent } from "@/types";

export function defaultCompany(): CompanyContent {
  return {
    name: COMPANY_NAME,
    platformName: PLATFORM_NAME,
    tagline: "Deploy your websites with simplicity.",
    mission: "",
    aboutPlatform: "",
    aboutCompany: "",
    whyExists: "",
  };
}
