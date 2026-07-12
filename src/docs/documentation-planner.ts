import { TechnologyProfile } from '../domain';
import {
  DocumentationPlan,
  DocumentationStage,
  DocumentGeneratorKind,
  DocumentSource,
  PlannedDocument,
} from '../domain/documentation-plan';
import {
  CapabilityMapStageKnowledge,
  ModuleDocumentationPlanEntry,
  ModuleDocumentationPlanKnowledge,
  ModuleKnowledge,
  ProjectKnowledge,
  StagedDocumentationKnowledge,
  StagedDocumentationStageExecution,
  StagedDocumentationStatus,
} from '../knowledge';
import { selectModulesForProductAiFanOut } from '../analyzers/module-constants';
import { AI_READINESS_DOCUMENT_PATH } from '../readiness/ai-readiness-model';

export const MODULE_DOCUMENTATION_PLAN_PATH = 'module-documentation-plan.md';
export const MODULE_DOCUMENT_DIRECTORY = 'code/components';

export const AI_READINESS_DOCUMENT: PlannedDocument = {
  title: 'AI Readiness Score',
  relativePath: AI_READINESS_DOCUMENT_PATH,
  purpose:
    'Deterministic Context Engineering assessment of how prepared this repository is for AI coding agents',
  priority: 'recommended',
  source: 'core',
  stage: 'readiness',
  generatorKind: 'deterministic',
};

function withBaselineMeta(
  document: PlannedDocument,
  stage: DocumentationStage = 'baseline',
  generatorKind: DocumentGeneratorKind = 'deterministic',
): PlannedDocument {
  return {
    ...document,
    stage: document.stage ?? stage,
    generatorKind: document.generatorKind ?? generatorKind,
  };
}

const CORE_DOCUMENTS: ReadonlyArray<PlannedDocument> = [
  withBaselineMeta({
    title: 'Project README',
    relativePath: 'README.md',
    purpose: 'High-level project overview for agents and humans entering the codebase',
    priority: 'required',
    source: 'core',
  }),
  withBaselineMeta(
    {
      title: 'Architecture Overview',
      relativePath: 'architecture.md',
      purpose: 'System design, layer diagram, and key architectural decisions',
      priority: 'required',
      source: 'core',
    },
    'architecture',
    'staged-architecture',
  ),
  withBaselineMeta({
    title: 'Folder Structure',
    relativePath: 'folder-structure.md',
    purpose: 'Maps every folder to its single responsibility',
    priority: 'required',
    source: 'core',
  }),
  withBaselineMeta({
    title: 'Agent Navigation',
    relativePath: 'agent-navigation.md',
    purpose: 'Guides AI agents to the right files for any task type',
    priority: 'required',
    source: 'core',
  }),
  withBaselineMeta({
    title: 'Conventions',
    relativePath: 'conventions.md',
    purpose: 'Coding, naming, and structural conventions to follow',
    priority: 'required',
    source: 'core',
  }),
  withBaselineMeta({
    title: 'Dependency Map',
    relativePath: 'dependency-map.md',
    purpose: 'Key internal and external dependencies with rationale',
    priority: 'required',
    source: 'core',
  }),
  withBaselineMeta({
    title: 'Change Log',
    relativePath: 'change-log.md',
    purpose: 'Recent changes agents should be aware of',
    priority: 'required',
    source: 'core',
  }),
];

const AGENT_DOCUMENTS: ReadonlyArray<PlannedDocument> = [
  withBaselineMeta(
    {
      title: 'Agent Instructions',
      relativePath: 'AGENTS.md',
      purpose: 'Mandatory entry point for any AI agent working in this repository',
      priority: 'required',
      source: 'agent',
      dependsOn: ['architecture.md', 'folder-structure.md'],
    },
    'routing',
    'deterministic',
  ),
  withBaselineMeta({
    title: 'AI Context',
    relativePath: 'ai-context.md',
    purpose: 'Curated context snapshot optimized for AI agent consumption',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'conventions.md'],
  }, 'architecture', 'staged-architecture'),
  withBaselineMeta({
    title: 'Implementation Guide',
    relativePath: 'implementation-guide.md',
    purpose: 'Step-by-step guidance for common implementation tasks',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'folder-structure.md', 'conventions.md'],
  }),
];

const PLAYBOOK_ROUTING_DOCUMENTS: ReadonlyArray<PlannedDocument> = [
  {
    title: 'AI Start Here',
    relativePath: 'AI_START_HERE.md',
    purpose: 'Short orientation: what this system is and the key constraints for agents',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 1,
    dependsOn: ['AGENTS.md'],
  },
  {
    title: 'Context Router',
    relativePath: 'CONTEXT_ROUTER.md',
    purpose: 'Ordered reading paths by task type for AI agents',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 2,
    dependsOn: ['agent-navigation.md'],
  },
  {
    title: 'Documentation Maintenance',
    relativePath: 'DOCUMENTATION_MAINTENANCE.md',
    purpose: 'How to keep agent documentation aligned with code in the same session',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 3,
  },
  {
    title: 'Documentation Status',
    relativePath: 'DOCUMENTATION_STATUS.md',
    purpose: 'Honest coverage status for staged and playbook documentation outputs',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 4,
  },
  {
    title: 'Project Map',
    relativePath: 'PROJECT_MAP.md',
    purpose: 'Compact map of modules, folders, and documentation entry points',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 5,
    dependsOn: ['folder-structure.md', 'architecture.md'],
  },
  {
    title: 'Code Index',
    relativePath: 'code/index.md',
    purpose: 'Entry-point index to all code documentation in this repository',
    priority: 'recommended',
    source: 'playbook',
    stage: 'routing',
    generatorKind: 'deterministic',
    order: 6,
    dependsOn: ['PROJECT_MAP.md'],
  },
];

const MODULE_PLAN_DOCUMENT: PlannedDocument = {
  title: 'Module Documentation Plan',
  relativePath: MODULE_DOCUMENTATION_PLAN_PATH,
  purpose: 'Explains the module-by-module documentation sequence derived from discovered modules',
  priority: 'required',
  source: 'playbook',
  stage: 'module-plan',
  generatorKind: 'staged-module-plan',
  order: 1,
  dependsOn: ['architecture.md', 'PROJECT_MAP.md'],
};

function angularDocuments(): PlannedDocument[] {
  return [
    withBaselineMeta({
      title: 'Angular Architecture',
      relativePath: 'angular-architecture.md',
      purpose: 'NgModules, components, services, and dependency injection patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    }, 'architecture'),
    withBaselineMeta({
      title: 'Angular Folder Context',
      relativePath: 'angular-folder-context.md',
      purpose: 'Angular-specific folder conventions and file organization',
      priority: 'required',
      source: 'technology',
      dependsOn: ['folder-structure.md'],
    }),
    withBaselineMeta({
      title: 'Angular Testing',
      relativePath: 'angular-testing.md',
      purpose: 'Component testing, TestBed setup, and testing patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['angular-architecture.md'],
    }),
  ];
}

function reactDocuments(): PlannedDocument[] {
  return [
    withBaselineMeta({
      title: 'React Architecture',
      relativePath: 'react-architecture.md',
      purpose: 'Component hierarchy, state management, and rendering patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    }, 'architecture'),
    withBaselineMeta({
      title: 'React Folder Context',
      relativePath: 'react-folder-context.md',
      purpose: 'React-specific folder conventions and component organization',
      priority: 'required',
      source: 'technology',
      dependsOn: ['folder-structure.md'],
    }),
    withBaselineMeta({
      title: 'React Testing',
      relativePath: 'react-testing.md',
      purpose: 'Component testing patterns and testing library usage',
      priority: 'required',
      source: 'technology',
      dependsOn: ['react-architecture.md'],
    }),
  ];
}

function nestjsDocuments(): PlannedDocument[] {
  return [
    withBaselineMeta({
      title: 'NestJS Architecture',
      relativePath: 'nestjs-architecture.md',
      purpose: 'Controllers, providers, guards, and module structure',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    }, 'architecture'),
    withBaselineMeta({
      title: 'NestJS Modules',
      relativePath: 'nestjs-modules.md',
      purpose: 'Module organization, imports, and dependency injection',
      priority: 'required',
      source: 'technology',
      dependsOn: ['nestjs-architecture.md'],
    }),
    withBaselineMeta({
      title: 'NestJS Testing',
      relativePath: 'nestjs-testing.md',
      purpose: 'Unit and e2e testing patterns for NestJS modules',
      priority: 'required',
      source: 'technology',
      dependsOn: ['nestjs-architecture.md'],
    }),
  ];
}

function fallbackTechnologyDocument(): PlannedDocument {
  return withBaselineMeta({
    title: 'Technology Overview',
    relativePath: 'technology-overview.md',
    purpose: 'Overview of the detected technology stack and its conventions',
    priority: 'required',
    source: 'technology',
    dependsOn: ['architecture.md'],
  });
}

function buildTechnologyDocuments(profile: TechnologyProfile): PlannedDocument[] {
  const docs: PlannedDocument[] = [];

  if (profile.frameworks.includes('Angular')) {
    docs.push(...angularDocuments());
  }
  if (profile.frameworks.includes('React')) {
    docs.push(...reactDocuments());
  }
  if (profile.frameworks.includes('NestJS')) {
    docs.push(...nestjsDocuments());
  }

  if (docs.length === 0) {
    docs.push(fallbackTechnologyDocument());
  }

  return docs;
}

function buildStrategy(profile: TechnologyProfile): string {
  const knownFrameworks = ['Angular', 'React', 'NestJS'];
  const matched = profile.frameworks.filter((f) => knownFrameworks.includes(f));
  if (matched.length === 0) {
    return 'standard';
  }
  return `standard-${matched.map((f) => f.toLowerCase()).join('-')}`;
}

export function createDocumentationPlan(
  docsDir: string,
  technologyProfile: TechnologyProfile,
): DocumentationPlan {
  const documents: PlannedDocument[] = [
    ...CORE_DOCUMENTS,
    AI_READINESS_DOCUMENT,
    ...AGENT_DOCUMENTS,
    ...buildTechnologyDocuments(technologyProfile),
  ];

  return {
    docsDir,
    documents,
    generatedAt: new Date().toISOString(),
    strategy: buildStrategy(technologyProfile),
  };
}

export function sanitizeCapabilitySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length > 0 ? slug : 'capability';
}

export function buildCapabilityStubDocuments(
  capabilityMap: CapabilityMapStageKnowledge,
): PlannedDocument[] {
  const docs: PlannedDocument[] = [];

  for (const feature of capabilityMap.features.slice(0, 8)) {
    const slug = sanitizeCapabilitySlug(feature.name);
    docs.push({
      title: feature.name,
      relativePath: `features/${slug}/index.md`,
      purpose: feature.summary || `Feature documentation for ${feature.name}`,
      priority: 'recommended',
      source: 'playbook',
      stage: 'routing',
      generatorKind: 'capability-stub',
      dependsOn: ['code/index.md'],
    });
  }

  for (const integration of capabilityMap.integrations.slice(0, 8)) {
    const slug = sanitizeCapabilitySlug(integration.name);
    docs.push({
      title: integration.name,
      relativePath: `integrations/${slug}/index.md`,
      purpose: integration.summary || `Integration documentation for ${integration.name}`,
      priority: 'recommended',
      source: 'playbook',
      stage: 'routing',
      generatorKind: 'capability-stub',
      dependsOn: ['code/index.md'],
    });
  }

  return docs;
}

export function sanitizeModuleDocumentSlug(moduleRelativePath: string, moduleName: string): string {
  const posixPath = moduleRelativePath.replace(/\\/g, '/');
  const raw = (
    posixPath === '.' || posixPath.length === 0 ? moduleName : posixPath
  ).replace(/^\/+|\/+$/g, '');
  const slug = raw
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/+/g, '__')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length > 0 ? slug : 'module';
}

export function buildModuleDocumentPath(module: ModuleKnowledge): string {
  return `${MODULE_DOCUMENT_DIRECTORY}/${sanitizeModuleDocumentSlug(module.relativePath, module.name)}.md`;
}

function sortModulesForDocumentation(modules: readonly ModuleKnowledge[]): ModuleKnowledge[] {
  return [...modules].sort((left, right) => {
    const confidenceRank = (value: ModuleKnowledge['confidence']): number => {
      if (value === 'high') return 0;
      if (value === 'medium') return 1;
      return 2;
    };
    const byConfidence = confidenceRank(left.confidence) - confidenceRank(right.confidence);
    if (byConfidence !== 0) {
      return byConfidence;
    }
    return left.relativePath.localeCompare(right.relativePath);
  });
}

export function buildModuleDocumentationPlanEntries(
  modules: readonly ModuleKnowledge[],
): ModuleDocumentationPlanEntry[] {
  const productModules = selectModulesForProductAiFanOut([...modules]);
  return sortModulesForDocumentation(productModules).map((module, index) => ({
    moduleId: module.relativePath,
    moduleName: module.name,
    moduleRelativePath: module.relativePath,
    documentPath: buildModuleDocumentPath(module),
    order: index + 1,
    status: 'pending' as const,
    rationale: module.responsibility,
  }));
}

export function buildModulePlanDocuments(modules: readonly ModuleKnowledge[]): PlannedDocument[] {
  const entries = buildModuleDocumentationPlanEntries(modules);
  const moduleDocuments: PlannedDocument[] = entries.map((entry) => ({
    title: `Module: ${entry.moduleName}`,
    relativePath: entry.documentPath,
    purpose: `Module documentation for ${entry.moduleRelativePath}`,
    priority: 'recommended',
    source: 'module' as DocumentSource,
    stage: 'module',
    generatorKind: 'staged-module',
    moduleId: entry.moduleId,
    moduleName: entry.moduleName,
    order: entry.order,
    dependsOn: [MODULE_DOCUMENTATION_PLAN_PATH, 'architecture.md'],
  }));

  return [...PLAYBOOK_ROUTING_DOCUMENTS, MODULE_PLAN_DOCUMENT, ...moduleDocuments];
}

function isExpandableModulePlanDocument(document: PlannedDocument): boolean {
  return (
    document.source === 'playbook' ||
    document.source === 'module' ||
    document.stage === 'module-plan' ||
    document.stage === 'module'
  );
}

/**
 * Expands an early baseline plan with playbook routing docs, a module-plan doc,
 * one document per discovered module, and optional capability stubs. Idempotent for already-expanded plans.
 */
export function expandDocumentationPlanWithModules(
  plan: DocumentationPlan,
  modules: readonly ModuleKnowledge[],
  capabilityStubs: readonly PlannedDocument[] = [],
): DocumentationPlan {
  const retained = plan.documents.filter((document) => !isExpandableModulePlanDocument(document));
  const expanded = [...retained, ...buildModulePlanDocuments(modules), ...capabilityStubs];

  return {
    ...plan,
    documents: expanded,
    generatedAt: new Date().toISOString(),
    strategy: plan.strategy.includes('module-aware')
      ? plan.strategy
      : `${plan.strategy}-module-aware`,
  };
}

export function buildModuleDocumentationPlanKnowledge(
  modules: readonly ModuleKnowledge[],
  generatedAt: string = new Date().toISOString(),
): ModuleDocumentationPlanKnowledge {
  const entries = buildModuleDocumentationPlanEntries(modules);
  return {
    status: entries.length > 0 ? 'completed' : 'partial',
    entries,
    generatedAt,
    warnings:
      entries.length === 0
        ? ['No modules discovered; module documentation plan contains routing docs only']
        : [],
  };
}

export interface ModuleDocumentationPlanExpansionResult {
  knowledge: ProjectKnowledge;
  moduleCount: number;
  addedDocuments: number;
  message: string;
}

function getOrCreateStagedDocumentation(
  knowledge: ProjectKnowledge,
): StagedDocumentationKnowledge {
  const existing = knowledge.analysis.stagedDocumentation;
  if (existing !== undefined) {
    return {
      ...existing,
      execution: [...existing.execution],
    };
  }
  return { execution: [] };
}

/**
 * Expands the documentation plan from discovered modules and mirrors the
 * module-plan entries into analysis.stagedDocumentation.modulePlan.
 */
export function expandProjectKnowledgeWithModuleDocumentationPlan(
  knowledge: ProjectKnowledge,
): ModuleDocumentationPlanExpansionResult {
  const modules = knowledge.analysis.modules ?? [];
  const capabilityMap = knowledge.analysis.stagedDocumentation?.capabilityMap;
  const capabilityStubs =
    capabilityMap?.status === 'completed' ? buildCapabilityStubDocuments(capabilityMap) : [];

  const previousCount = knowledge.documentation.plan.documents.length;
  const expandedPlan = expandDocumentationPlanWithModules(
    knowledge.documentation.plan,
    modules,
    capabilityStubs,
  );
  const generatedAt = expandedPlan.generatedAt;
  const modulePlan = buildModuleDocumentationPlanKnowledge(modules, generatedAt);

  const staged = getOrCreateStagedDocumentation(knowledge);
  const modulePlanStatus: StagedDocumentationStatus =
    modulePlan.status === 'completed' ? 'completed' : 'partial';
  const modulePlanExecution: StagedDocumentationStageExecution = {
    stageId: 'module-plan',
    status: modulePlanStatus,
    startedAt: generatedAt,
    completedAt: generatedAt,
    warnings: [...modulePlan.warnings],
  };
  staged.modulePlan = modulePlan;
  staged.execution = [...staged.execution.filter((entry) => entry.stageId !== 'module-plan'), modulePlanExecution].sort(
    (left, right) => left.stageId.localeCompare(right.stageId),
  );
  staged.generatedAt = generatedAt;

  const nextKnowledge: ProjectKnowledge = {
    ...knowledge,
    documentation: {
      ...knowledge.documentation,
      plan: expandedPlan,
    },
    analysis: {
      ...knowledge.analysis,
      status: knowledge.analysis.status === 'pending' ? 'partial' : knowledge.analysis.status,
      stagedDocumentation: staged,
    },
  };

  const addedDocuments = expandedPlan.documents.length - previousCount;

  return {
    knowledge: nextKnowledge,
    moduleCount: modules.length,
    addedDocuments: Math.max(0, addedDocuments),
    message: `expanded documentation plan with ${modules.length} module(s), ${addedDocuments} document(s) added`,
  };
}
