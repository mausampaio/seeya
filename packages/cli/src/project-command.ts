/**
 * `seeya project create | list | show` (V2-T27, `docs/PLANO-DE-ENTREGA.md` § "Projetos — o
 * recorte"). Thin by design (AGENTS.md § "Registro e saída"): each function only calls
 * `application/workspace.ts`'s own orchestration and hands the result to `format-project.ts` —
 * the same split every other command module in this package already follows
 * (`autostart-command.ts`, `snooze-command.ts`).
 */
import {
  createProject,
  listProjects,
  showProject,
} from '@seeya-ai/engine/application/workspace.js';
import type { ProjectContext } from './composition.js';
import {
  formatCreateProjectReport,
  formatProjectsReport,
  formatShowProjectReport,
} from './format-project.js';

export async function runProjectCreateCommand(
  context: ProjectContext,
  projectId: string,
): Promise<string> {
  const result = await createProject(context, projectId);
  return formatCreateProjectReport(result);
}

export async function runProjectListCommand(context: ProjectContext): Promise<string> {
  const result = await listProjects(context);
  return formatProjectsReport(result);
}

export async function runProjectShowCommand(
  context: ProjectContext,
  projectId: string,
): Promise<string> {
  const result = await showProject(context, projectId);
  return formatShowProjectReport(result);
}
