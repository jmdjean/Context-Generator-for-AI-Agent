import { RepositoryNode } from '../domain';
import { DocumentationValidationResult } from '../docs/documentation-validator';
import {
  ConventionKnowledge,
  FolderKnowledge,
  ModuleKnowledge,
  NavigationEntry,
  NavigationTaskType,
  ProjectKnowledge,
} from '../knowledge/project-knowledge';
import { AIReadinessFinding, AIReadinessFindingStatus } from './ai-readiness-model';

/**
 * Version of the deterministic scoring rules. Bump this whenever a rule,
 * weight, or threshold changes so persisted scores remain comparable.
 */
export const AI_READINESS_SCORING_VERSION = '1.0.0';

/** Repositories at or below these sizes are treated as tiny: several structural
 * checks become not-applicable instead of failing. */
const TINY_REPOSITORY_MAX_SOURCE_FILES = 5;
const TINY_REPOSITORY_MAX_TOTAL_FILES = 12;

/** Ratio thresholds shared by coverage-style checks. */
const PASSED_RATIO_THRESHOLD = 0.8;
const PARTIAL_RATIO_THRESHOLD = 0.5;

const SOURCE_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rb', '.go', '.rs',
  '.java', '.kt', '.cs', '.php', '.swift', '.c', '.cc', '.cpp', '.h', '.hpp',
  '.scala', '.vue', '.svelte',
]);

const REQUIRED_CONTEXT_DOCUMENTS: ReadonlyArray<string> = [
  'architecture.md',
  'folder-structure.md',
  'dependency-map.md',
  'conventions.md',
  'agent-navigation.md',
  'ai-context.md',
  'implementation-guide.md',
];

const COMMON_NAVIGATION_TASK_TYPES: ReadonlyArray<NavigationTaskType> = [
  'new-feature',
  'bug-fix',
  'architecture-change',
  'test-change',
  'config-change',
  'dependency-change',
];

export interface ReadinessRepositorySignals {
  fileCount: number;
  directoryCount: number;
  sourceFileCount: number;
  testFileCount: number;
  moduleCount: number;
  folderContextCount: number;
  sourceFolderCount: number;
  isTinyRepository: boolean;
  isInitialRun: boolean;
}

export interface ReadinessRuleInput {
  knowledge: ProjectKnowledge;
  validation?: DocumentationValidationResult;
  signals: ReadinessRepositorySignals;
}

/** A finding plus the deterministic follow-up action shown when it is not passed. */
export interface ReadinessFindingEvaluation {
  finding: AIReadinessFinding;
  recommendedAction?: string;
}

export interface ReadinessCategoryRule {
  id: string;
  name: string;
  weight: number;
  buildFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[];
}

function countTreeNodes(tree: RepositoryNode | undefined): {
  fileCount: number;
  directoryCount: number;
  sourceFileCount: number;
  testFileCount: number;
} {
  let fileCount = 0;
  let directoryCount = 0;
  let sourceFileCount = 0;
  let testFileCount = 0;

  const visit = (node: RepositoryNode): void => {
    if (node.type === 'file') {
      fileCount += 1;

      const name = node.name.toLowerCase();
      const extension = (node.extension ?? '').toLowerCase();
      if (SOURCE_FILE_EXTENSIONS.has(extension)) {
        sourceFileCount += 1;
      }
      if (
        name.includes('.test.') ||
        name.includes('.spec.') ||
        node.relativePath.includes('__tests__')
      ) {
        testFileCount += 1;
      }
      return;
    }

    if (node.relativePath.length > 0) {
      directoryCount += 1;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  if (tree !== undefined) {
    visit(tree);
  }

  return { fileCount, directoryCount, sourceFileCount, testFileCount };
}

export function deriveRepositorySignals(knowledge: ProjectKnowledge): ReadinessRepositorySignals {
  const treeCounts = countTreeNodes(knowledge.repository.repositoryTree);
  const folderContexts = knowledge.analysis.folderContexts ?? [];
  const modules = knowledge.analysis.modules ?? [];

  const hasTestFolders = folderContexts.some((folder) => folder.classification === 'test');

  return {
    fileCount: treeCounts.fileCount,
    directoryCount: treeCounts.directoryCount,
    sourceFileCount: treeCounts.sourceFileCount,
    testFileCount: hasTestFolders && treeCounts.testFileCount === 0 ? 1 : treeCounts.testFileCount,
    moduleCount: modules.length,
    folderContextCount: folderContexts.length,
    sourceFolderCount: folderContexts.filter((folder) => folder.classification === 'source').length,
    isTinyRepository:
      treeCounts.sourceFileCount <= TINY_REPOSITORY_MAX_SOURCE_FILES ||
      treeCounts.fileCount <= TINY_REPOSITORY_MAX_TOTAL_FILES,
    isInitialRun: knowledge.analysis.changeSummary?.isInitialRun ?? true,
  };
}

function pointsForStatus(status: AIReadinessFindingStatus, maxPoints: number): number {
  if (status === 'passed') {
    return maxPoints;
  }
  if (status === 'partial') {
    return maxPoints / 2;
  }
  return 0;
}

interface FindingSpec {
  id: string;
  status: AIReadinessFindingStatus;
  description: string;
  evidence: string[];
  maxPoints: number;
  recommendedAction?: string;
}

function evaluation(spec: FindingSpec): ReadinessFindingEvaluation {
  const finding: AIReadinessFinding = {
    id: spec.id,
    status: spec.status,
    description: spec.description,
    evidence: spec.evidence,
    points: pointsForStatus(spec.status, spec.maxPoints),
    maxPoints: spec.maxPoints,
  };

  if (spec.status === 'passed' || spec.status === 'not-applicable') {
    return { finding };
  }

  return { finding, recommendedAction: spec.recommendedAction };
}

function statusFromRatio(ratio: number): AIReadinessFindingStatus {
  if (ratio >= PASSED_RATIO_THRESHOLD) {
    return 'passed';
  }
  if (ratio >= PARTIAL_RATIO_THRESHOLD) {
    return 'partial';
  }
  return 'failed';
}

function formatRatio(matched: number, total: number): string {
  return `${matched} of ${total}`;
}

// --- 1. Repository Structure -------------------------------------------------

function buildRepositoryStructureFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge, signals } = input;
  const folderContexts = knowledge.analysis.folderContexts ?? [];
  const findings: ReadinessFindingEvaluation[] = [];

  const hasTree = knowledge.repository.repositoryTree !== undefined;
  findings.push(
    evaluation({
      id: 'repository-tree-generated',
      status: hasTree ? 'passed' : 'failed',
      description: hasTree
        ? 'The repository tree was generated and persisted in the PKM.'
        : 'The repository tree is missing from the PKM.',
      evidence: hasTree
        ? [`repository tree contains ${signals.fileCount} file(s) and ${signals.directoryCount} folder(s)`]
        : ['repository.repositoryTree is undefined'],
      maxPoints: 6,
      recommendedAction:
        'Re-run the repository scan so the PKM contains a complete repository tree.',
    }),
  );

  if (signals.directoryCount === 0) {
    findings.push(
      evaluation({
        id: 'source-folders-identified',
        status: 'not-applicable',
        description: 'The repository has no subfolders, so source folder detection does not apply.',
        evidence: ['repository tree contains no directories'],
        maxPoints: 5,
      }),
    );
  } else {
    const status: AIReadinessFindingStatus =
      signals.sourceFolderCount > 0
        ? 'passed'
        : signals.folderContextCount > 0
          ? signals.isTinyRepository
            ? 'not-applicable'
            : 'partial'
          : 'failed';
    findings.push(
      evaluation({
        id: 'source-folders-identified',
        status,
        description:
          signals.sourceFolderCount > 0
            ? 'Source folders were identified by the folder analyzer.'
            : 'No folder was classified as a source folder.',
        evidence: [
          `${signals.sourceFolderCount} folder(s) classified as source out of ${signals.folderContextCount} analyzed`,
        ],
        maxPoints: 5,
        recommendedAction:
          'Organize source files under a recognizable source folder (for example src/) so the folder analyzer can classify them.',
      }),
    );
  }

  const hasIgnoredPaths = knowledge.repository.ignoredPaths.length > 0;
  findings.push(
    evaluation({
      id: 'generated-folders-excluded',
      status: hasIgnoredPaths ? 'passed' : signals.isTinyRepository ? 'not-applicable' : 'partial',
      description: hasIgnoredPaths
        ? 'Ignored and generated folders were excluded from the scan.'
        : 'No ignored paths were recorded during the scan.',
      evidence: hasIgnoredPaths
        ? [`${knowledge.repository.ignoredPaths.length} path(s) excluded, e.g. ${knowledge.repository.ignoredPaths.slice(0, 3).join(', ')}`]
        : ['repository.ignoredPaths is empty'],
      maxPoints: 3,
      recommendedAction:
        'Add a .gitignore covering build output and dependency folders so generated files stay out of the context.',
    }),
  );

  if (folderContexts.length === 0) {
    findings.push(
      evaluation({
        id: 'folder-responsibilities-inferred',
        status: signals.directoryCount === 0 ? 'not-applicable' : 'failed',
        description: 'No folder contexts with inferred responsibilities are available.',
        evidence: ['analysis.folderContexts is empty or missing'],
        maxPoints: 6,
        recommendedAction:
          'Run the folder analyzer so every important folder has an inferred responsibility.',
      }),
    );
  } else {
    const known = folderContexts.filter(
      (folder: FolderKnowledge) =>
        folder.classification !== 'unknown' && folder.responsibility.trim().length > 0,
    );
    const ratio = known.length / folderContexts.length;
    findings.push(
      evaluation({
        id: 'folder-responsibilities-inferred',
        status: statusFromRatio(ratio),
        description:
          ratio >= PASSED_RATIO_THRESHOLD
            ? 'Important folders have inferred responsibilities.'
            : 'Some analyzed folders have unknown classifications or empty responsibilities.',
        evidence: [
          `${formatRatio(known.length, folderContexts.length)} analyzed folder(s) have a known classification and responsibility`,
        ],
        maxPoints: 6,
        recommendedAction:
          'Add evidence-backed folder responsibilities for unknown source folders.',
      }),
    );
  }

  findings.push(
    evaluation({
      id: 'modules-discovered',
      status:
        signals.moduleCount > 0 ? 'passed' : signals.isTinyRepository ? 'not-applicable' : 'failed',
      description:
        signals.moduleCount > 0
          ? 'Modules were discovered from the repository structure.'
          : 'No modules were discovered.',
      evidence: [`${signals.moduleCount} module(s) in analysis.modules`],
      maxPoints: 5,
      recommendedAction:
        'Group related source files into recognizable module folders so the module analyzer can discover them.',
    }),
  );

  return findings;
}

// --- 2. Architecture Knowledge -----------------------------------------------

function buildArchitectureFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge, signals } = input;
  const modules = knowledge.analysis.modules ?? [];
  const graph = knowledge.analysis.dependencyGraph;
  const conventions = knowledge.analysis.conventions ?? [];
  const findings: ReadinessFindingEvaluation[] = [];

  findings.push(
    evaluation({
      id: 'modules-defined',
      status:
        signals.moduleCount > 0 ? 'passed' : signals.isTinyRepository ? 'not-applicable' : 'failed',
      description:
        signals.moduleCount > 0
          ? 'The PKM contains discovered modules.'
          : 'The PKM contains no module knowledge.',
      evidence: [`${signals.moduleCount} module(s) in analysis.modules`],
      maxPoints: 4,
      recommendedAction:
        'Structure the codebase into module folders so architecture knowledge can be derived.',
    }),
  );

  if (modules.length === 0) {
    findings.push(
      evaluation({
        id: 'module-responsibilities-documented',
        status: signals.isTinyRepository ? 'not-applicable' : 'failed',
        description: 'Module responsibilities cannot be evaluated without discovered modules.',
        evidence: ['analysis.modules is empty or missing'],
        maxPoints: 5,
        recommendedAction:
          'Structure the codebase into module folders so module responsibilities can be inferred.',
      }),
    );
  } else {
    const documented = modules.filter(
      (module: ModuleKnowledge) =>
        module.responsibility.trim().length > 0 && module.type !== 'unknown',
    );
    const ratio = documented.length / modules.length;
    findings.push(
      evaluation({
        id: 'module-responsibilities-documented',
        status: statusFromRatio(ratio),
        description:
          ratio >= PASSED_RATIO_THRESHOLD
            ? 'Discovered modules carry responsibilities and types.'
            : 'Some discovered modules lack a responsibility or a known type.',
        evidence: [
          `${formatRatio(documented.length, modules.length)} module(s) have a responsibility and a known type`,
        ],
        maxPoints: 5,
        recommendedAction:
          'Review modules with unknown types and add structural signals so their responsibilities can be inferred.',
      }),
    );
  }

  const hasGraph = graph !== undefined;
  findings.push(
    evaluation({
      id: 'dependency-graph-generated',
      status: hasGraph ? 'passed' : signals.isTinyRepository ? 'not-applicable' : 'failed',
      description: hasGraph
        ? 'A module dependency graph was generated.'
        : 'No dependency graph is available in the PKM.',
      evidence: hasGraph
        ? [`${graph.nodes.length} node(s) and ${graph.edges.length} edge(s) in analysis.dependencyGraph`]
        : ['analysis.dependencyGraph is undefined'],
      maxPoints: 5,
      recommendedAction:
        'Run the dependency graph analyzer so module relationships are captured in the PKM.',
    }),
  );

  if (!hasGraph) {
    findings.push(
      evaluation({
        id: 'dependency-edges-evidence-backed',
        status: 'not-applicable',
        description: 'Dependency edge evidence cannot be evaluated without a dependency graph.',
        evidence: ['analysis.dependencyGraph is undefined'],
        maxPoints: 6,
      }),
    );
  } else if (graph.edges.length === 0) {
    // A graph with no edges is expected for single-module or tiny repositories,
    // suspicious for medium ones, and a real gap once many modules exist.
    const status: AIReadinessFindingStatus =
      signals.moduleCount <= 1 || signals.isTinyRepository
        ? 'not-applicable'
        : signals.moduleCount >= 5
          ? 'failed'
          : 'partial';
    findings.push(
      evaluation({
        id: 'dependency-edges-evidence-backed',
        status,
        description:
          status === 'not-applicable'
            ? 'The repository is too small for meaningful dependency edges.'
            : 'The dependency graph has no edges even though multiple modules exist.',
        evidence: [`0 edge(s) across ${signals.moduleCount} module(s)`],
        maxPoints: 6,
        recommendedAction:
          'Verify that module imports are parseable so dependency edges can be detected between modules.',
      }),
    );
  } else {
    const withEvidence = graph.edges.filter((edge) => edge.evidence.length > 0);
    const ratio = withEvidence.length / graph.edges.length;
    findings.push(
      evaluation({
        id: 'dependency-edges-evidence-backed',
        status: statusFromRatio(ratio),
        description:
          ratio >= PASSED_RATIO_THRESHOLD
            ? 'Dependency edges are backed by import evidence.'
            : 'Some module relationships lack dependency evidence.',
        evidence: [
          `${formatRatio(withEvidence.length, graph.edges.length)} dependency edge(s) carry import evidence`,
        ],
        maxPoints: 6,
        recommendedAction:
          'Re-run the dependency analyzer so every module relationship is backed by import evidence.',
      }),
    );
  }

  const architectureConventions = conventions.filter(
    (convention: ConventionKnowledge) =>
      convention.category === 'architecture' || convention.category === 'repository-structure',
  );
  const architectureStatus: AIReadinessFindingStatus =
    architectureConventions.length > 0 ? 'passed' : conventions.length > 0 ? 'partial' : 'failed';
  findings.push(
    evaluation({
      id: 'architecture-boundaries-detected',
      status: architectureStatus,
      description:
        architectureStatus === 'passed'
          ? 'Architecture boundaries or structural conventions were detected.'
          : 'No architecture or repository-structure conventions were detected.',
      evidence: [
        `${architectureConventions.length} architecture/repository-structure convention(s) out of ${conventions.length} total`,
      ],
      maxPoints: 4,
      recommendedAction:
        'Adopt recognizable structural boundaries (for example layered src/ folders) so architecture conventions can be detected.',
    }),
  );

  return findings;
}

// --- 3. Documentation Coverage -----------------------------------------------

function documentReportedMissing(
  validation: DocumentationValidationResult | undefined,
  relativePath: string,
): boolean {
  if (validation === undefined) {
    return false;
  }
  return validation.issues.some(
    (issue) => issue.severity === 'error' && issue.relativePath === relativePath,
  );
}

function buildDocumentationFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge, validation } = input;
  const plan = knowledge.documentation.plan;
  const plannedPaths = new Set(plan.documents.map((document) => document.relativePath));
  const findings: ReadinessFindingEvaluation[] = [];

  const requiredPlanned = plan.documents.filter((document) => document.priority === 'required');
  const hasPlan = plan.documents.length > 0;
  findings.push(
    evaluation({
      id: 'documentation-plan-defined',
      status: hasPlan ? (requiredPlanned.length > 0 ? 'passed' : 'partial') : 'failed',
      description: hasPlan
        ? 'A documentation plan with required documents exists.'
        : 'The documentation plan is empty.',
      evidence: [
        `${plan.documents.length} planned document(s), ${requiredPlanned.length} required`,
      ],
      maxPoints: 4,
      recommendedAction:
        'Regenerate the documentation plan so required context documents are planned.',
    }),
  );

  const missingDocuments = REQUIRED_CONTEXT_DOCUMENTS.filter(
    (documentPath) =>
      !plannedPaths.has(documentPath) || documentReportedMissing(validation, documentPath),
  );
  const presentCount = REQUIRED_CONTEXT_DOCUMENTS.length - missingDocuments.length;
  const coverageRatio = presentCount / REQUIRED_CONTEXT_DOCUMENTS.length;
  findings.push(
    evaluation({
      id: 'required-context-documents-present',
      status: statusFromRatio(coverageRatio),
      description:
        missingDocuments.length === 0
          ? 'All required context documents are planned and generated.'
          : `Required context documents are missing: ${missingDocuments.join(', ')}.`,
      evidence: [
        `${formatRatio(presentCount, REQUIRED_CONTEXT_DOCUMENTS.length)} required context document(s) present`,
      ],
      maxPoints: 10,
      recommendedAction:
        missingDocuments.length > 0
          ? `Restore the missing context document(s): ${missingDocuments.join(', ')}.`
          : undefined,
    }),
  );

  const validationStatus: AIReadinessFindingStatus =
    validation === undefined ? 'partial' : validation.errorCount === 0 ? 'passed' : 'failed';
  findings.push(
    evaluation({
      id: 'documentation-validation-passed',
      status: validationStatus,
      description:
        validationStatus === 'passed'
          ? 'Documentation validation passed.'
          : validationStatus === 'failed'
            ? 'Documentation validation reported errors.'
            : 'No documentation validation result is available for this run.',
      evidence:
        validation === undefined
          ? ['validation result was not provided to the readiness calculator']
          : [`${validation.errorCount} error(s), ${validation.warningCount} warning(s)`],
      maxPoints: 6,
      recommendedAction:
        'Resolve documentation validation errors before sharing context with an AI agent.',
    }),
  );

  return findings;
}

// --- 4. Agent Navigation -----------------------------------------------------

function buildNavigationFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge } = input;
  const navigationMap = knowledge.analysis.navigationMap;
  const entries = navigationMap?.entries ?? [];
  const findings: ReadinessFindingEvaluation[] = [];

  const hasMap = entries.length > 0;
  findings.push(
    evaluation({
      id: 'navigation-map-generated',
      status: hasMap ? 'passed' : 'failed',
      description: hasMap
        ? 'A task navigation map for AI agents exists.'
        : 'No navigation map entries are available.',
      evidence: [`${entries.length} navigation entr(ies) in analysis.navigationMap`],
      maxPoints: 4,
      recommendedAction:
        'Run the navigation map analyzer so agents receive task-based reading guidance.',
    }),
  );

  if (!hasMap) {
    // The remaining checks would all fail for the same root cause; mark them
    // not-applicable so a missing map is penalized exactly once.
    for (const id of [
      'common-tasks-covered',
      'navigation-recommends-documents',
      'navigation-includes-warnings',
      'navigation-grounded-in-pkm',
    ]) {
      findings.push(
        evaluation({
          id,
          status: 'not-applicable',
          description: 'Not evaluated because the navigation map is missing.',
          evidence: ['analysis.navigationMap has no entries'],
          maxPoints: id === 'common-tasks-covered' ? 4 : id === 'navigation-grounded-in-pkm' ? 4 : 2,
        }),
      );
    }
    return findings;
  }

  const coveredTaskTypes = new Set(entries.map((entry) => entry.taskType));
  const missingTasks = COMMON_NAVIGATION_TASK_TYPES.filter(
    (taskType) => !coveredTaskTypes.has(taskType),
  );
  const taskRatio =
    (COMMON_NAVIGATION_TASK_TYPES.length - missingTasks.length) /
    COMMON_NAVIGATION_TASK_TYPES.length;
  findings.push(
    evaluation({
      id: 'common-tasks-covered',
      status: statusFromRatio(taskRatio),
      description:
        missingTasks.length === 0
          ? 'All common task types have navigation guidance.'
          : `Navigation guidance is missing for: ${missingTasks.join(', ')}.`,
      evidence: [
        `${formatRatio(COMMON_NAVIGATION_TASK_TYPES.length - missingTasks.length, COMMON_NAVIGATION_TASK_TYPES.length)} common task type(s) covered`,
      ],
      maxPoints: 4,
      recommendedAction:
        missingTasks.length > 0
          ? `Add task navigation for ${missingTasks.map((task) => task.replace('-', ' ')).join(' and ')} tasks.`
          : undefined,
    }),
  );

  const withDocuments = entries.filter(
    (entry: NavigationEntry) => entry.recommendedDocuments.length > 0,
  );
  const documentsRatio = withDocuments.length / entries.length;
  findings.push(
    evaluation({
      id: 'navigation-recommends-documents',
      status: statusFromRatio(documentsRatio),
      description:
        documentsRatio >= PASSED_RATIO_THRESHOLD
          ? 'Navigation entries recommend documents to read first.'
          : 'Some navigation entries recommend no documents.',
      evidence: [
        `${formatRatio(withDocuments.length, entries.length)} entr(ies) recommend at least one document`,
      ],
      maxPoints: 2,
      recommendedAction:
        'Attach recommended documents to every navigation entry so agents know what to read first.',
    }),
  );

  const withWarnings = entries.filter((entry) => entry.warnings.length > 0);
  findings.push(
    evaluation({
      id: 'navigation-includes-warnings',
      status: withWarnings.length > 0 ? 'passed' : 'partial',
      description:
        withWarnings.length > 0
          ? 'Navigation entries include cautionary warnings for agents.'
          : 'No navigation entry carries warnings; agents get no cautionary guidance.',
      evidence: [`${formatRatio(withWarnings.length, entries.length)} entr(ies) include warnings`],
      maxPoints: 2,
      recommendedAction:
        'Add warnings to navigation entries for tasks with known pitfalls.',
    }),
  );

  const plannedPaths = new Set(
    knowledge.documentation.plan.documents.map((document) => document.relativePath),
  );
  // The navigation builder stores module relative paths; accept names too so
  // the check stays robust if that representation ever changes.
  const moduleNames = new Set(
    (knowledge.analysis.modules ?? []).flatMap((module) => [module.name, module.relativePath]),
  );
  const folderPaths = new Set(
    (knowledge.analysis.folderContexts ?? []).map((folder) => folder.relativePath),
  );

  let groundedEntries = 0;
  const unknownReferences: string[] = [];
  for (const entry of entries) {
    const unknownDocuments = entry.recommendedDocuments.filter((doc) => !plannedPaths.has(doc));
    const unknownModules = entry.relatedModules.filter((name) => !moduleNames.has(name));
    const unknownFolders = entry.relatedFolders.filter((folder) => !folderPaths.has(folder));
    if (unknownDocuments.length + unknownModules.length + unknownFolders.length === 0) {
      groundedEntries += 1;
    } else {
      unknownReferences.push(...unknownDocuments, ...unknownModules, ...unknownFolders);
    }
  }
  const groundedRatio = groundedEntries / entries.length;
  findings.push(
    evaluation({
      id: 'navigation-grounded-in-pkm',
      status: statusFromRatio(groundedRatio),
      description:
        groundedRatio >= PASSED_RATIO_THRESHOLD
          ? 'Navigation references resolve to known documents, modules, and folders.'
          : 'Navigation entries reference documents, modules, or folders unknown to the PKM.',
      evidence: [
        `${formatRatio(groundedEntries, entries.length)} entr(ies) fully grounded in the PKM`,
        ...(unknownReferences.length > 0
          ? [`unknown references: ${[...new Set(unknownReferences)].slice(0, 5).join(', ')}`]
          : []),
      ],
      maxPoints: 4,
      recommendedAction:
        'Fix navigation entries that reference unknown documents, modules, or folders.',
    }),
  );

  return findings;
}

// --- 5. Project Conventions ----------------------------------------------------

function buildConventionFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge, signals } = input;
  const conventions = knowledge.analysis.conventions ?? [];
  const findings: ReadinessFindingEvaluation[] = [];

  findings.push(
    evaluation({
      id: 'structured-conventions-detected',
      status: conventions.length > 0 ? 'passed' : 'failed',
      description:
        conventions.length > 0
          ? 'Structured project conventions were detected.'
          : 'No structured conventions were detected.',
      evidence: [`${conventions.length} convention(s) in analysis.conventions`],
      maxPoints: 4,
      recommendedAction:
        'Run the convention analyzer so project conventions become part of the generated context.',
    }),
  );

  if (conventions.length === 0) {
    findings.push(
      evaluation({
        id: 'conventions-evidence-backed',
        status: 'not-applicable',
        description: 'Convention evidence cannot be evaluated without detected conventions.',
        evidence: ['analysis.conventions is empty or missing'],
        maxPoints: 3,
      }),
    );
  } else {
    const withEvidence = conventions.filter((convention) => convention.evidence.length > 0);
    const ratio = withEvidence.length / conventions.length;
    findings.push(
      evaluation({
        id: 'conventions-evidence-backed',
        status: statusFromRatio(ratio),
        description:
          ratio >= PASSED_RATIO_THRESHOLD
            ? 'Detected conventions are backed by evidence.'
            : 'Some detected conventions carry no evidence.',
        evidence: [
          `${formatRatio(withEvidence.length, conventions.length)} convention(s) carry evidence`,
        ],
        maxPoints: 3,
        recommendedAction:
          'Attach file or config evidence to conventions so agents can verify them.',
      }),
    );
  }

  const hasTestingSignals = signals.testFileCount > 0;
  const hasTestingConvention = conventions.some(
    (convention) => convention.category === 'testing',
  );
  findings.push(
    evaluation({
      id: 'testing-convention-detected',
      status: !hasTestingSignals
        ? 'not-applicable'
        : hasTestingConvention
          ? 'passed'
          : 'partial',
      description: !hasTestingSignals
        ? 'No test files were found, so testing conventions do not apply.'
        : hasTestingConvention
          ? 'A testing convention was detected.'
          : 'Testing conventions were only partially detected.',
      evidence: hasTestingSignals
        ? [`${signals.testFileCount} test file signal(s); testing convention ${hasTestingConvention ? 'present' : 'absent'}`]
        : ['no test files or test folders detected in the repository tree'],
      maxPoints: 3,
      recommendedAction:
        'Add a test script and consistent test file layout so testing conventions can be fully detected.',
    }),
  );

  const hasPackageManagerSignal =
    knowledge.technologies.packageManagers.length > 0 ||
    knowledge.repository.packageManager !== undefined;
  const hasPackageManagerConvention = conventions.some(
    (convention) => convention.category === 'package-management',
  );
  findings.push(
    evaluation({
      id: 'package-manager-convention-detected',
      status: !hasPackageManagerSignal
        ? 'not-applicable'
        : hasPackageManagerConvention
          ? 'passed'
          : 'partial',
      description: !hasPackageManagerSignal
        ? 'No package manager was detected, so this check does not apply.'
        : hasPackageManagerConvention
          ? 'A package manager convention was detected.'
          : 'A package manager was detected but no convention documents it.',
      evidence: [
        `package managers: ${knowledge.technologies.packageManagers.join(', ') || 'none'}; convention ${hasPackageManagerConvention ? 'present' : 'absent'}`,
      ],
      maxPoints: 2,
      recommendedAction:
        'Commit a single lockfile so the package manager convention becomes unambiguous.',
    }),
  );

  const usesTypeScript = knowledge.technologies.languages.includes('TypeScript');
  const hasStrictModeConvention = conventions.some(
    (convention) =>
      convention.category === 'language' && /strict/i.test(convention.name),
  );
  findings.push(
    evaluation({
      id: 'typescript-strict-mode-detected',
      status: !usesTypeScript ? 'not-applicable' : hasStrictModeConvention ? 'passed' : 'failed',
      description: !usesTypeScript
        ? 'The project does not use TypeScript, so strict mode does not apply.'
        : hasStrictModeConvention
          ? 'TypeScript strict mode is enabled and documented as a convention.'
          : 'TypeScript strict mode was not detected.',
      evidence: usesTypeScript
        ? [`strict mode convention ${hasStrictModeConvention ? 'present' : 'absent'} in analysis.conventions`]
        : ['TypeScript is not among the detected languages'],
      maxPoints: 3,
      recommendedAction: 'Enable TypeScript strict mode to improve type-level context.',
    }),
  );

  const hasGeneratedContextConvention = conventions.some(
    (convention) => convention.category === 'generated-context',
  );
  findings.push(
    evaluation({
      id: 'generated-context-rules-documented',
      status: hasGeneratedContextConvention ? 'passed' : 'partial',
      description: hasGeneratedContextConvention
        ? 'Rules for the generated context are documented as conventions.'
        : 'No generated-context conventions document how the generated files should be treated.',
      evidence: [
        `generated-context convention ${hasGeneratedContextConvention ? 'present' : 'absent'} in analysis.conventions`,
      ],
      maxPoints: 2,
      recommendedAction:
        'Keep the generated docs directory in place so generated-context conventions are detected and documented.',
    }),
  );

  return findings;
}

// --- 6. Context Maintainability -----------------------------------------------

function buildMaintainabilityFindings(input: ReadinessRuleInput): ReadinessFindingEvaluation[] {
  const { knowledge, validation } = input;
  const changeSummary = knowledge.analysis.changeSummary;
  const findings: ReadinessFindingEvaluation[] = [];

  const hasSchemaVersion = knowledge.metadata.schemaVersion.trim().length > 0;
  findings.push(
    evaluation({
      id: 'pkm-schema-version-present',
      status: hasSchemaVersion ? 'passed' : 'failed',
      description: hasSchemaVersion
        ? 'The PKM declares a schema version.'
        : 'The PKM has no schema version.',
      evidence: [`metadata.schemaVersion: ${knowledge.metadata.schemaVersion || '(empty)'}`],
      maxPoints: 2,
      recommendedAction:
        'Regenerate the PKM with the current generator so it carries a schema version.',
    }),
  );

  // The initial run has no previous state to load; that must not count against
  // the score. Only an unreadable or mismatched baseline signals a real problem.
  let persistenceStatus: AIReadinessFindingStatus;
  let persistenceDescription: string;
  if (changeSummary === undefined) {
    persistenceStatus = 'partial';
    persistenceDescription = 'PKM persistence could not be confirmed for this run.';
  } else if (changeSummary.baselineStatus === 'loaded') {
    persistenceStatus = 'passed';
    persistenceDescription = 'A previously persisted PKM snapshot was loaded successfully.';
  } else if (changeSummary.isInitialRun) {
    persistenceStatus = 'passed';
    persistenceDescription =
      'Initial run: the PKM will be persisted at the end of this run; no baseline is expected yet.';
  } else {
    persistenceStatus = 'partial';
    persistenceDescription = `The previous PKM snapshot could not be reused (baseline: ${changeSummary.baselineStatus}).`;
  }
  findings.push(
    evaluation({
      id: 'pkm-persisted',
      status: persistenceStatus,
      description: persistenceDescription,
      evidence: [
        changeSummary === undefined
          ? 'analysis.changeSummary is missing'
          : `baseline status: ${changeSummary.baselineStatus}; initial run: ${changeSummary.isInitialRun}`,
      ],
      maxPoints: 2,
      recommendedAction:
        'Keep the persisted knowledge directory intact between runs so incremental analysis can reuse it.',
    }),
  );

  const validationStatus: AIReadinessFindingStatus =
    validation === undefined ? 'partial' : validation.errorCount === 0 ? 'passed' : 'partial';
  findings.push(
    evaluation({
      id: 'validation-integrated',
      status: validationStatus,
      description:
        validation === undefined
          ? 'No validation result is available for this run.'
          : validation.errorCount === 0
            ? 'Documentation validation runs and passes for the generated context.'
            : 'Documentation validation runs but reported errors that reduce maintainability.',
      evidence:
        validation === undefined
          ? ['validation result was not provided to the readiness calculator']
          : [`${validation.errorCount} validation error(s), ${validation.warningCount} warning(s)`],
      maxPoints: 2,
      recommendedAction:
        'Resolve documentation validation errors before sharing context with an AI agent.',
    }),
  );

  findings.push(
    evaluation({
      id: 'incremental-change-detection',
      status: changeSummary !== undefined ? 'passed' : 'failed',
      description:
        changeSummary !== undefined
          ? 'Incremental change detection compared this run against the previous snapshot.'
          : 'No incremental change summary is available.',
      evidence: [
        changeSummary !== undefined
          ? `${changeSummary.changedSections.length} changed section(s) recorded`
          : 'analysis.changeSummary is missing',
      ],
      maxPoints: 2,
      recommendedAction:
        'Run the full pipeline so change detection records what moved between runs.',
    }),
  );

  const hasDocumentImpact = knowledge.analysis.documentImpact !== undefined;
  findings.push(
    evaluation({
      id: 'selective-regeneration',
      status: hasDocumentImpact ? 'passed' : 'failed',
      description: hasDocumentImpact
        ? 'Document impact analysis enables selective regeneration.'
        : 'No document impact summary is available for selective regeneration.',
      evidence: [
        hasDocumentImpact
          ? `${knowledge.analysis.documentImpact?.impactedDocuments.length ?? 0} impacted document(s) recorded`
          : 'analysis.documentImpact is missing',
      ],
      maxPoints: 1,
      recommendedAction:
        'Run the full pipeline so document impact analysis can drive selective regeneration.',
    }),
  );

  const markerIssues =
    validation?.issues.filter((issue) => issue.message.includes('generated-file marker')) ?? [];
  findings.push(
    evaluation({
      id: 'generated-files-protected',
      status:
        validation === undefined ? 'partial' : markerIssues.length === 0 ? 'passed' : 'failed',
      description:
        validation === undefined
          ? 'Protection markers could not be confirmed without a validation result.'
          : markerIssues.length === 0
            ? 'Generated files carry protection markers so user edits are preserved.'
            : 'Some generated files are missing the protection marker.',
      evidence:
        validation === undefined
          ? ['validation result was not provided to the readiness calculator']
          : [`${markerIssues.length} document(s) reported without the generated-file marker`],
      maxPoints: 1,
      recommendedAction:
        'Regenerate documents that lost their generated-file marker so they stay safely updatable.',
    }),
  );

  return findings;
}

export const READINESS_CATEGORY_RULES: ReadonlyArray<ReadinessCategoryRule> = [
  {
    id: 'repository-structure',
    name: 'Repository Structure',
    weight: 20,
    buildFindings: buildRepositoryStructureFindings,
  },
  {
    id: 'architecture-knowledge',
    name: 'Architecture Knowledge',
    weight: 20,
    buildFindings: buildArchitectureFindings,
  },
  {
    id: 'documentation-coverage',
    name: 'Documentation Coverage',
    weight: 20,
    buildFindings: buildDocumentationFindings,
  },
  {
    id: 'agent-navigation',
    name: 'Agent Navigation',
    weight: 15,
    buildFindings: buildNavigationFindings,
  },
  {
    id: 'project-conventions',
    name: 'Project Conventions',
    weight: 15,
    buildFindings: buildConventionFindings,
  },
  {
    id: 'context-maintainability',
    name: 'Context Maintainability',
    weight: 10,
    buildFindings: buildMaintainabilityFindings,
  },
];

export function totalCategoryWeight(
  rules: ReadonlyArray<ReadinessCategoryRule> = READINESS_CATEGORY_RULES,
): number {
  return rules.reduce((sum, rule) => sum + rule.weight, 0);
}
