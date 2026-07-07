import { TechnologyProfile } from '../domain';
import { DocumentationPlan, PlannedDocument } from '../domain/documentation-plan';

const CORE_DOCUMENTS: ReadonlyArray<PlannedDocument> = [
  {
    title: 'Project README',
    relativePath: 'README.md',
    purpose: 'High-level project overview for agents and humans entering the codebase',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Architecture Overview',
    relativePath: 'architecture.md',
    purpose: 'System design, layer diagram, and key architectural decisions',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Folder Structure',
    relativePath: 'folder-structure.md',
    purpose: 'Maps every folder to its single responsibility',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Agent Navigation',
    relativePath: 'agent-navigation.md',
    purpose: 'Guides AI agents to the right files for any task type',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Conventions',
    relativePath: 'conventions.md',
    purpose: 'Coding, naming, and structural conventions to follow',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Dependency Map',
    relativePath: 'dependency-map.md',
    purpose: 'Key internal and external dependencies with rationale',
    priority: 'required',
    source: 'core',
  },
  {
    title: 'Change Log',
    relativePath: 'change-log.md',
    purpose: 'Recent changes agents should be aware of',
    priority: 'required',
    source: 'core',
  },
];

const AGENT_DOCUMENTS: ReadonlyArray<PlannedDocument> = [
  {
    title: 'Agent Instructions',
    relativePath: 'AGENTS.md',
    purpose: 'Mandatory entry point for any AI agent working in this repository',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'folder-structure.md'],
  },
  {
    title: 'AI Context',
    relativePath: 'ai-context.md',
    purpose: 'Curated context snapshot optimized for AI agent consumption',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'conventions.md'],
  },
  {
    title: 'Implementation Guide',
    relativePath: 'implementation-guide.md',
    purpose: 'Step-by-step guidance for common implementation tasks',
    priority: 'required',
    source: 'agent',
    dependsOn: ['architecture.md', 'folder-structure.md', 'conventions.md'],
  },
];

function angularDocuments(): PlannedDocument[] {
  return [
    {
      title: 'Angular Architecture',
      relativePath: 'angular-architecture.md',
      purpose: 'NgModules, components, services, and dependency injection patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    },
    {
      title: 'Angular Folder Context',
      relativePath: 'angular-folder-context.md',
      purpose: 'Angular-specific folder conventions and file organization',
      priority: 'required',
      source: 'technology',
      dependsOn: ['folder-structure.md'],
    },
    {
      title: 'Angular Testing',
      relativePath: 'angular-testing.md',
      purpose: 'Component testing, TestBed setup, and testing patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['angular-architecture.md'],
    },
  ];
}

function reactDocuments(): PlannedDocument[] {
  return [
    {
      title: 'React Architecture',
      relativePath: 'react-architecture.md',
      purpose: 'Component hierarchy, state management, and rendering patterns',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    },
    {
      title: 'React Folder Context',
      relativePath: 'react-folder-context.md',
      purpose: 'React-specific folder conventions and component organization',
      priority: 'required',
      source: 'technology',
      dependsOn: ['folder-structure.md'],
    },
    {
      title: 'React Testing',
      relativePath: 'react-testing.md',
      purpose: 'Component testing patterns and testing library usage',
      priority: 'required',
      source: 'technology',
      dependsOn: ['react-architecture.md'],
    },
  ];
}

function nestjsDocuments(): PlannedDocument[] {
  return [
    {
      title: 'NestJS Architecture',
      relativePath: 'nestjs-architecture.md',
      purpose: 'Controllers, providers, guards, and module structure',
      priority: 'required',
      source: 'technology',
      dependsOn: ['architecture.md'],
    },
    {
      title: 'NestJS Modules',
      relativePath: 'nestjs-modules.md',
      purpose: 'Module organization, imports, and dependency injection',
      priority: 'required',
      source: 'technology',
      dependsOn: ['nestjs-architecture.md'],
    },
    {
      title: 'NestJS Testing',
      relativePath: 'nestjs-testing.md',
      purpose: 'Unit and e2e testing patterns for NestJS modules',
      priority: 'required',
      source: 'technology',
      dependsOn: ['nestjs-architecture.md'],
    },
  ];
}

function fallbackTechnologyDocument(): PlannedDocument {
  return {
    title: 'Technology Overview',
    relativePath: 'technology-overview.md',
    purpose: 'Overview of the detected technology stack and its conventions',
    priority: 'required',
    source: 'technology',
    dependsOn: ['architecture.md'],
  };
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
