import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  buildProviderSkillDirCandidates,
  isSkillMountedForProvider,
  resolveCatCafeSkillsSourceDir,
  resolveMainRepoPath,
  type SkillProviderMountKey,
} from './skill-mount.js';
import {
  listSkillDirs,
  parseBootstrap,
  parseManifestSkillMeta,
  resolveSkillMcpStatuses,
  type SkillMcpDependency,
} from './skill-parse.js';

export interface ProviderSkillCatalogEntry {
  name: string;
  category: string;
  trigger: string;
  mounted: boolean;
  description?: string;
  requiresMcp?: SkillMcpDependency[];
}

export type ProviderSkillCatalog = Record<SkillProviderMountKey, ProviderSkillCatalogEntry[]>;

function emptyProviderSkillCatalog(): ProviderSkillCatalog {
  return {
    claude: [],
    codex: [],
    gemini: [],
    kimi: [],
  };
}

export async function buildProviderSkillCatalog(projectRoot: string): Promise<ProviderSkillCatalog> {
  const skillsSrc = resolveCatCafeSkillsSourceDir();
  const providerDirCandidates = buildProviderSkillDirCandidates(projectRoot, homedir());
  const mainRepo = await resolveMainRepoPath();
  const mainSkillsSrc = join(mainRepo, 'cat-cafe-skills');

  const [sourceSkills, bootstrapEntries, manifestMeta] = await Promise.all([
    listSkillDirs(skillsSrc),
    parseBootstrap(join(skillsSrc, 'BOOTSTRAP.md')),
    parseManifestSkillMeta(skillsSrc),
  ]);
  if (sourceSkills.length === 0) return emptyProviderSkillCatalog();

  const mcpStatuses = await resolveSkillMcpStatuses(projectRoot, manifestMeta);
  const sourceSet = new Set(sourceSkills);
  const ordered: string[] = [];
  const bootstrapOrdered = new Set<string>();
  for (const bsName of bootstrapEntries.keys()) {
    if (sourceSet.has(bsName)) {
      ordered.push(bsName);
      bootstrapOrdered.add(bsName);
    }
  }
  for (const name of sourceSkills) {
    if (!bootstrapOrdered.has(name)) ordered.push(name);
  }

  const result = emptyProviderSkillCatalog();
  await Promise.all(
    ordered.map(async (name) => {
      const [claude, codex, gemini, kimi] = await Promise.all([
        isSkillMountedForProvider(providerDirCandidates.claude, skillsSrc, name, mainSkillsSrc),
        isSkillMountedForProvider(providerDirCandidates.codex, skillsSrc, name, mainSkillsSrc),
        isSkillMountedForProvider(providerDirCandidates.gemini, skillsSrc, name, mainSkillsSrc),
        isSkillMountedForProvider(providerDirCandidates.kimi, skillsSrc, name, mainSkillsSrc),
      ]);
      const entry = bootstrapEntries.get(name);
      const meta = manifestMeta.get(name);
      const catalogEntry: Omit<ProviderSkillCatalogEntry, 'mounted'> = {
        name,
        category: entry?.category ?? '未分类',
        trigger: meta?.triggers?.length ? meta.triggers.join('、') : (entry?.trigger ?? ''),
        ...(meta?.description ? { description: meta.description } : {}),
        ...(meta?.requiresMcp?.length
          ? {
              requiresMcp: meta.requiresMcp.map((id) => mcpStatuses.get(id) ?? { id, status: 'missing' as const }),
            }
          : {}),
      };
      result.claude.push({ ...catalogEntry, mounted: claude });
      result.codex.push({ ...catalogEntry, mounted: codex });
      result.gemini.push({ ...catalogEntry, mounted: gemini });
      result.kimi.push({ ...catalogEntry, mounted: kimi });
    }),
  );
  return result;
}
