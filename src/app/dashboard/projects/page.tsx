import type { Metadata } from "next";
import { FolderGit2, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { ProjectCard } from "@/components/deployment/project-card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/types/database";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  const search = q?.trim().replace(/[%,()]/g, "");
  if (search) query = query.or(`name.ilike.%${search}%,repo_name.ilike.%${search}%`);
  const { data } = await query;
  const projects = (data as Project[]) ?? [];

  return (
    <>
      <PageHeader
        title="Projects"
        description="All projects imported from your GitHub repositories."
        actions={
          <ButtonLink href="/dashboard/projects/new">
            <Plus className="h-4 w-4" /> New Project
          </ButtonLink>
        }
      />
      <Card className="mb-6 overflow-hidden">
        <TableToolbar placeholder="Search projects…" />
      </Card>
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderGit2 className="h-5 w-5" />}
            title={search ? "No matching projects" : "No projects yet"}
            description={search ? "Try a different search term." : "Import a GitHub repository to create your first project."}
            action={
              !search && (
                <ButtonLink href="/dashboard/projects/new" size="sm">
                  <Plus className="h-4 w-4" /> New Project
                </ButtonLink>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
