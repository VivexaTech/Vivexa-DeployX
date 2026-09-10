"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api/client";

export default function AdminPage() {
  const { push } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState({ phone: "", email: "" });
  const [company, setCompany] = useState({
    name: "Vivexa Tech",
    platformName: "Vivexa DeployX",
    tagline: "",
    mission: "",
    aboutPlatform: "",
    aboutCompany: "",
    whyExists: "",
  });
  const [reserved, setReserved] = useState("");
  const [plan, setPlan] = useState({
    planName: "",
    planPrice: 0,
    keyPoints: "",
    maxWebsites: 1,
    duration: "yearly",
    razorpayPlanId: "",
    displayOrder: 1,
    freeSubdomain: true,
    customDomain: true,
    staticWebsite: true,
    dynamicWebsite: false,
    githubDeployment: true,
  });
  const [project, setProject] = useState({
    title: "",
    description: "",
    image: "",
    projectUrl: "",
    category: "",
  });

  useEffect(() => {
    apiFetch<{
      support: { phone?: string; email?: string } | null;
      company: typeof company | null;
      reservedSubdomains: string[];
    }>("/api/admin/content")
      .then((payload) => {
        if (payload.support) setSupport({ phone: payload.support.phone ?? "", email: payload.support.email ?? "" });
        if (payload.company) setCompany((current) => ({ ...current, ...payload.company }));
        setReserved((payload.reservedSubdomains ?? []).join(", "));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function save(kind: string, data: unknown) {
    await apiFetch("/api/admin/content", { method: "POST", body: JSON.stringify({ kind, data }) });
    push({ title: "Saved", tone: "success" });
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Admin content</h1>
        <ThemeToggle compact />
      </div>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Support</h2>
        <Input placeholder="Phone" value={support.phone} onChange={(e) => setSupport({ ...support, phone: e.target.value })} />
        <Input placeholder="Email" value={support.email} onChange={(e) => setSupport({ ...support, email: e.target.value })} />
        <Button onClick={() => void save("support", support)}>Save support</Button>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Company</h2>
        {Object.entries(company).map(([key, value]) => (
          <div key={key}>
            <Label>{key}</Label>
            <Textarea value={value} onChange={(e) => setCompany({ ...company, [key]: e.target.value })} />
          </div>
        ))}
        <Button onClick={() => void save("company", company)}>Save company</Button>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Reserved subdomains</h2>
        <Input value={reserved} onChange={(e) => setReserved(e.target.value)} />
        <Button onClick={() => void save("reserved", { names: reserved.split(",").map((item) => item.trim()).filter(Boolean) })}>
          Save reserved names
        </Button>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Add pricing plan</h2>
        <Input placeholder="Plan name" value={plan.planName} onChange={(e) => setPlan({ ...plan, planName: e.target.value })} />
        <Input type="number" placeholder="Price" value={plan.planPrice} onChange={(e) => setPlan({ ...plan, planPrice: Number(e.target.value) })} />
        <Input placeholder="Duration" value={plan.duration} onChange={(e) => setPlan({ ...plan, duration: e.target.value })} />
        <Input type="number" placeholder="Max websites" value={plan.maxWebsites} onChange={(e) => setPlan({ ...plan, maxWebsites: Number(e.target.value) })} />
        <Input type="number" placeholder="Display order" value={plan.displayOrder} onChange={(e) => setPlan({ ...plan, displayOrder: Number(e.target.value) })} />
        <Input placeholder="Razorpay plan ID" value={plan.razorpayPlanId} onChange={(e) => setPlan({ ...plan, razorpayPlanId: e.target.value })} />
        <Textarea placeholder="Key points, one per line" value={plan.keyPoints} onChange={(e) => setPlan({ ...plan, keyPoints: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.freeSubdomain} onChange={(e) => setPlan({ ...plan, freeSubdomain: e.target.checked })} /> Free subdomain</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.customDomain} onChange={(e) => setPlan({ ...plan, customDomain: e.target.checked })} /> Custom domain</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.staticWebsite} onChange={(e) => setPlan({ ...plan, staticWebsite: e.target.checked })} /> Static websites</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.dynamicWebsite} onChange={(e) => setPlan({ ...plan, dynamicWebsite: e.target.checked })} /> Dynamic websites</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.githubDeployment} onChange={(e) => setPlan({ ...plan, githubDeployment: e.target.checked })} /> GitHub deployment</label>
        <Button
          onClick={() =>
            void save("plan", {
              ...plan,
              keyPoints: plan.keyPoints.split("\n").filter(Boolean),
              billingCycle: plan.duration.toLowerCase().includes("year") ? "yearly" : "monthly",
              active: true,
              features: {
                freeSubdomain: plan.freeSubdomain,
                customDomain: plan.customDomain,
                staticWebsite: plan.staticWebsite,
                dynamicWebsite: plan.dynamicWebsite,
                githubDeployment: plan.githubDeployment,
              },
            })
          }
        >
          Save plan
        </Button>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Add showcase project</h2>
        <Input placeholder="Title" value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} />
        <Textarea placeholder="Description" value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} />
        <Input placeholder="Image URL" value={project.image} onChange={(e) => setProject({ ...project, image: e.target.value })} />
        <Input placeholder="Project URL" value={project.projectUrl} onChange={(e) => setProject({ ...project, projectUrl: e.target.value })} />
        <Input placeholder="Category" value={project.category} onChange={(e) => setProject({ ...project, category: e.target.value })} />
        <Button onClick={() => void save("project", project)}>Save project</Button>
      </Card>
    </div>
  );
}
