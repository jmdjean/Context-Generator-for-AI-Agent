import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inferModuleTypeFromManifests,
  isDocumentationOnlyModule,
  isModuleManifestFileName,
  listOwnedModuleManifests,
  modulePathContainsRelativePath,
  selectModulesForProductAiFanOut,
} from './module-constants';
import { ModuleKnowledge } from '../knowledge/project-knowledge';

function moduleStub(
  relativePath: string,
  type: ModuleKnowledge['type'],
): ModuleKnowledge {
  return {
    name: relativePath.split('/').pop() || 'root',
    path: `/repo/${relativePath}`,
    relativePath,
    type,
    responsibility: 'test',
    importantFiles: [],
    relatedFolders: [],
    signals: [],
    confidence: 'high',
  };
}

describe('module-constants manifests', () => {
  it('recognizes multi-ecosystem manifest file names', () => {
    assert.equal(isModuleManifestFileName('package.json'), true);
    assert.equal(isModuleManifestFileName('pom.xml'), true);
    assert.equal(isModuleManifestFileName('build.gradle.kts'), true);
    assert.equal(isModuleManifestFileName('go.mod'), true);
    assert.equal(isModuleManifestFileName('Cargo.toml'), true);
    assert.equal(isModuleManifestFileName('pyproject.toml'), true);
    assert.equal(isModuleManifestFileName('Orders.csproj'), true);
    assert.equal(isModuleManifestFileName('Lib.fsproj'), true);
    assert.equal(isModuleManifestFileName('README.md'), false);
  });

  it('lists owned manifests in stable order', () => {
    assert.deepEqual(listOwnedModuleManifests(['README.md', 'pom.xml', 'package.json', 'pom.xml']), [
      'package.json',
      'pom.xml',
    ]);
  });

  it('infers module types from manifests with root package special-case', () => {
    assert.equal(inferModuleTypeFromManifests(['package.json'], ''), 'application');
    assert.equal(inferModuleTypeFromManifests(['package.json'], '.'), 'application');
    assert.equal(inferModuleTypeFromManifests(['package.json'], 'packages/core'), 'package');
    assert.equal(inferModuleTypeFromManifests(['Orders.csproj']), 'application');
    assert.equal(inferModuleTypeFromManifests(['pom.xml']), 'application');
    assert.equal(inferModuleTypeFromManifests(['pyproject.toml']), 'package');
    assert.equal(inferModuleTypeFromManifests([]), undefined);
  });

  it('treats repository-root module paths as containing every relative file path', () => {
    assert.equal(modulePathContainsRelativePath('.', 'src/index.js'), true);
    assert.equal(modulePathContainsRelativePath('', 'package.json'), true);
    assert.equal(modulePathContainsRelativePath('services/orders', 'services/orders/pom.xml'), true);
    assert.equal(modulePathContainsRelativePath('services/orders', 'tools/worker/Main.cs'), false);
  });

  it('filters documentation-only modules from product AI fan-out selection', () => {
    const modules = [
      moduleStub('src/core', 'core'),
      moduleStub('docs', 'documentation'),
      moduleStub('.ai-docs', 'documentation'),
      moduleStub('apps/api', 'application'),
    ];

    assert.equal(isDocumentationOnlyModule(modules[1]!), true);
    assert.deepEqual(
      selectModulesForProductAiFanOut(modules).map((module) => module.relativePath),
      ['src/core', 'apps/api'],
    );
  });
});
