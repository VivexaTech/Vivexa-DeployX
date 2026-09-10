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
    maxWebsites: 3,
    duration: "monthly",
    razorpayPlanId: "",
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
        <Input placeholder="Razorpay plan ID" value={plan.razorpayPlanId} onChange={(e) => setPlan({ ...plan, razorpayPlanId: e.target.value })} />
        <Textarea placeholder="Key points, one per line" value={plan.keyPoints} onChange={(e) => setPlan({ ...plan, keyPoints: e.target.value })} />
        <Button
          onClick={() =>
            void save("plan", {
              ...plan,
              keyPoints: plan.keyPoints.split("\n").filter(Boolean),
              active: true,
              features: {
                customDomains: true,
                githubDeployment: true,
                environmentVariables: true,
                automaticDeployments: false,
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
