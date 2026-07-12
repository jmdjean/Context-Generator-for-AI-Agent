import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyModule,
  inferModuleResponsibility,
  refineModuleConfidence,
  shouldIgnoreModulePath,
} from './module-classifier';

describe('module-classifier', () => {
  it('classifies monorepo application modules', () => {
    const result = classifyModule({
      relativePath: 'apps/admin',
      name: 'admin',
      docsDir: '.ai-docs',
    });

    assert.ok(result);
    assert.equal(result.type, 'application');
    assert.equal(result.confidence, 'high');
  });

  it('classifies library and package modules', () => {
    const library = classifyModule({
      relativePath: 'libs/ui',
      name: 'ui',
      docsDir: '.ai-docs',
    });
    const pkg = classifyModule({
      relativePath: 'packages/core',
      name: 'core',
      docsDir: '.ai-docs',
    });

    assert.equal(library?.type, 'library');
    assert.equal(pkg?.type, 'package');
  });

  it('classifies source-level modules and groups', () => {
    const feature = classifyModule({
      relativePath: 'src/features/users',
      name: 'users',
      docsDir: '.ai-docs',
    });
    const componentGroup = classifyModule({
      relativePath: 'src/components',
      name: 'components',
      docsDir: '.ai-docs',
    });
    const knowledge = classifyModule({
      relativePath: 'src/knowledge',
      name: 'knowledge',
      docsDir: '.ai-docs',
    });

    assert.equal(feature?.type, 'feature');
    assert.equal(componentGroup?.type, 'component-group');
    assert.equal(knowledge?.type, 'core');
  });

  it('classifies documentation modules from docs dir and custom output directories', () => {
    const docs = classifyModule({
      relativePath: 'docs',
      name: 'docs',
      docsDir: '.ai-docs',
    });
    const aiDocs = classifyModule({
      relativePath: '.ai-docs',
      name: '.ai-docs',
      docsDir: '.ai-docs',
    });
    const customDocs = classifyModule({
      relativePath: '.project-docs',
      name: '.project-docs',
      docsDir: '.project-docs',
    });
    const knowledgeStorage = classifyModule({
      relativePath: '.ai-docs/knowledge',
      name: 'knowledge',
      docsDir: '.ai-docs',
    });

    assert.equal(docs?.type, 'documentation');
    assert.equal(aiDocs?.type, 'documentation');
    assert.equal(customDocs?.type, 'documentation');
    assert.equal(knowledgeStorage, undefined);
    assert.equal(shouldIgnoreModulePath('.ai-docs/knowledge', '.ai-docs'), true);
  });

  it('downgrades confidence for container children without source folder classification', () => {
    const result = classifyModule({
      relativePath: 'packages/scanner',
      name: 'scanner',
      docsDir: '.ai-docs',
      folderClassification: 'unknown',
      folderConfidence: 'low',
    });

    assert.equal(result?.confidence, 'medium');
  });

  it('downgrades confidence for empty source-classified container children', () => {
    const result = classifyModule({
      relativePath: 'packages/scanner',
      name: 'scanner',
      docsDir: '.ai-docs',
      folderClassification: 'source',
      folderConfidence: 'high',
      hasImportantFiles: false,
      hasChildFolders: false,
    });

    assert.equal(result?.confidence, 'medium');
  });

  it('keeps direct platform modules high even when folder confidence is medium', () => {
    const result = classifyModule({
      relativePath: 'src/knowledge',
      name: 'knowledge',
      docsDir: '.ai-docs',
      folderClassification: 'source',
      folderConfidence: 'medium',
    });

    assert.equal(result?.confidence, 'high');
  });

  it('refines structural confidence using folder signals', () => {
    assert.equal(
      refineModuleConfidence('high', {
        relativePath: 'apps/admin',
        name: 'admin',
        docsDir: '.ai-docs',
        folderConfidence: 'medium',
      }),
      'medium',
    );
  });

  it('infers tailored responsibilities for known platform modules', () => {
    assert.match(
      inferModuleResponsibility('core', 'knowledge', 'src/knowledge', '.ai-docs'),
      /Project Knowledge Model/,
    );
    assert.match(
      inferModuleResponsibility('application', 'admin', 'apps/admin', '.ai-docs'),
      /application entrypoint/,
    );
    assert.match(
      inferModuleResponsibility('documentation', '.ai-docs', '.ai-docs', '.ai-docs'),
      /AI-readable project context/,
    );
  });

  it('classifies root and nested folders from owned manifests when path heuristics miss', () => {
    const rootPackage = classifyModule({
      relativePath: '.',
      name: 'bridge-server',
      docsDir: '.ai-docs',
      ownedFileNames: ['package.json', 'README.md'],
    });
    const javaService = classifyModule({
      relativePath: 'services/orders',
      name: 'orders',
      docsDir: '.ai-docs',
      ownedFileNames: ['pom.xml'],
    });
    const dotnetApp = classifyModule({
      relativePath: 'tools/worker',
      name: 'worker',
      docsDir: '.ai-docs',
      ownedFileNames: ['Worker.csproj'],
    });
    const withoutManifest = classifyModule({
      relativePath: 'services/orders',
      name: 'orders',
      docsDir: '.ai-docs',
      ownedFileNames: ['README.md'],
    });

    assert.equal(rootPackage?.type, 'application');
    assert.ok(rootPackage?.signals.includes('manifest:package.json'));
    assert.ok(rootPackage?.signals.includes('path:repository-root'));
    assert.equal(javaService?.type, 'application');
    assert.ok(javaService?.signals.includes('manifest:pom.xml'));
    assert.equal(dotnetApp?.type, 'application');
    assert.ok(dotnetApp?.signals.includes('manifest:Worker.csproj'));
    assert.equal(withoutManifest, undefined);
  });

  it('prefers path heuristics over manifest signals when both apply', () => {
    const result = classifyModule({
      relativePath: 'packages/core',
      name: 'core',
      docsDir: '.ai-docs',
      ownedFileNames: ['package.json'],
    });

    assert.equal(result?.type, 'package');
    assert.ok(result?.signals.includes('container:packages'));
    assert.equal(result?.signals.some((signal) => signal.startsWith('manifest:')), false);
  });
});
