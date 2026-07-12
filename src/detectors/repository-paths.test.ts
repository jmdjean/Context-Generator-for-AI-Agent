import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectRepositoryRelativePaths,
  findAllRepositoryPaths,
  findRepositoryPath,
  getSearchableRepositoryPaths,
  hasRepositoryPath,
  hasRepositoryPathWithExtension,
} from './repository-paths';
import { RepositoryInfo, RepositoryNode } from '../domain';

describe('repository-paths', () => {
  const tree: RepositoryNode = {
    name: 'project',
    path: '/tmp/project',
    relativePath: '',
    type: 'directory',
    children: [
      {
        name: 'package.json',
        path: '/tmp/project/package.json',
        relativePath: 'package.json',
        type: 'file',
      },
      {
        name: 'packages',
        path: '/tmp/project/packages',
        relativePath: 'packages',
        type: 'directory',
        children: [
          {
            name: 'tsconfig.json',
            path: '/tmp/project/packages/app/tsconfig.json',
            relativePath: 'packages/app/tsconfig.json',
            type: 'file',
          },
          {
            name: 'package.json',
            path: '/tmp/project/packages/app/package.json',
            relativePath: 'packages/app/package.json',
            type: 'file',
          },
        ],
      },
    ],
  };

  it('collects relative file paths from the repository tree', () => {
    assert.deepEqual(collectRepositoryRelativePaths(tree), [
      'package.json',
      'packages/app/tsconfig.json',
      'packages/app/package.json',
    ]);
  });

  it('finds nested repository paths by file name', () => {
    const paths = collectRepositoryRelativePaths(tree);

    assert.equal(findRepositoryPath(paths, 'package.json'), 'package.json');
    assert.equal(findRepositoryPath(paths, 'tsconfig.json'), 'packages/app/tsconfig.json');
  });

  it('lists all package.json paths with root first', () => {
    const paths = collectRepositoryRelativePaths(tree);

    assert.deepEqual(findAllRepositoryPaths(paths, 'package.json'), [
      'package.json',
      'packages/app/package.json',
    ]);
  });

  it('detects nested config files by relative path', () => {
    const paths = collectRepositoryRelativePaths(tree);

    assert.equal(hasRepositoryPath(paths, 'tsconfig.json'), true);
    assert.equal(hasRepositoryPath(paths, 'Dockerfile'), false);
  });

  it('detects files by extension across nested paths', () => {
    assert.equal(
      hasRepositoryPathWithExtension(['apps/desktop/DesktopApp.csproj'], '.csproj'),
      true,
    );
    assert.equal(hasRepositoryPathWithExtension(['services/orders/pom.xml'], '.csproj'), false);
  });

  it('falls back to top-level detected files when no tree exists', () => {
    const repositoryInfo: RepositoryInfo = {
      name: 'project',
      rootPath: '/tmp/project',
      detectedFiles: ['package.json', 'src'],
      ignoredPaths: [],
    };

    assert.deepEqual(getSearchableRepositoryPaths(repositoryInfo), ['package.json', 'src']);
  });
});
