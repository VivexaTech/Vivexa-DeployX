-- =============================================================================
-- Migration 0003: Automatic Git Deployment support & production deployment tracking
-- =============================================================================

-- Add auto_deploy, webhook_secret, and production_deployment_id to projects table
alter table public.projects
  add column if not exists auto_deploy boolean not null default true,
  add column if not exists webhook_secret text,
  add column if not exists production_deployment_id uuid references public.deployments (id) on delete set null;

-- Populate webhook_secret for existing projects if null
update public.projects
  set webhook_secret = encode(gen_random_bytes(24), 'hex')
  where webhook_secret is null;

-- Populate production_deployment_id for projects with existing ready deployments
update public.projects p
  set production_deployment_id = (
    select d.id
    from public.deployments d
    where d.project_id = p.id
      and d.status = 'ready'
    order by d.created_at desc
    limit 1
  )
  where p.production_deployment_id is null;

-- Fast index for webhook lookups on repository push events
create index if not exists projects_repo_branch_idx
  on public.projects (repo_owner, repo_name, branch);

create index if not exists projects_auto_deploy_idx
  on public.projects (auto_deploy);

create index if not exists projects_production_deployment_idx
  on public.projects (production_deployment_id);
