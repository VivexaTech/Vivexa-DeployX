export type FrameworkId = "nextjs" | "create-react-app" | "vite" | "vue" | "nuxtjs" | "astro" | "static" | "other";

export type FrameworkPreset = {
  id: FrameworkId;
  name: string;
  /** Value passed to the infrastructure provider's `framework` setting (null = auto/other). */
  providerSlug: string | null;
  buildCommand: string | null;
  installCommand: string | null;
  outputDirectory: string | null;
};

export const FRAMEWORKS: FrameworkPreset[] = [
  { id: "nextjs", name: "Next.js", providerSlug: "nextjs", buildCommand: "next build", installCommand: null, outputDirectory: null },
  { id: "create-react-app", name: "React (CRA)", providerSlug: "create-react-app", buildCommand: "react-scripts build", installCommand: null, outputDirectory: "build" },
  { id: "vite", name: "Vite / React", providerSlug: "vite", buildCommand: "vite build", installCommand: null, outputDirectory: "dist" },
  { id: "vue", name: "Vue", providerSlug: "vue", buildCommand: "vue-cli-service build", installCommand: null, outputDirectory: "dist" },
  { id: "nuxtjs", name: "Nuxt", providerSlug: "nuxtjs", buildCommand: "nuxt build", installCommand: null, outputDirectory: null },
  { id: "astro", name: "Astro", providerSlug: "astro", buildCommand: "astro build", installCommand: null, outputDirectory: "dist" },
  { id: "static", name: "Static HTML", providerSlug: null, buildCommand: null, installCommand: null, outputDirectory: null },
  { id: "other", name: "Other", providerSlug: null, buildCommand: null, installCommand: null, outputDirectory: null },
];

export function getFramework(id: string | null | undefined): FrameworkPreset {
  return FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[FRAMEWORKS.length - 1];
}

/** Detects the framework from package.json contents and top-level file names. */
export function detectFramework(packageJson: string | null, files: string[]): FrameworkId {
  const names = new Set(files.map((f) => f.toLowerCase()));
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) return "nextjs";
      if (deps.nuxt || deps.nuxt3) return "nuxtjs";
      if (deps.astro) return "astro";
      if (deps.vite) return "vite";
      if (deps["@vue/cli-service"]) return "vue";
      if (deps["react-scripts"]) return "create-react-app";
      if (deps.vue) return "vite";
    } catch {
      // fall through to file-based detection
    }
  }
  if ([...names].some((n) => n.startsWith("next.config"))) return "nextjs";
  if ([...names].some((n) => n.startsWith("nuxt.config"))) return "nuxtjs";
  if ([...names].some((n) => n.startsWith("astro.config"))) return "astro";
  if ([...names].some((n) => n.startsWith("vite.config"))) return "vite";
  if (names.has("index.html") && !packageJson) return "static";
  return "other";
}
