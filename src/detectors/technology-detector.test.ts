import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectTechnologies } from './technology-detector';
import { RepositoryInfo } from '../domain';
import { scanRepository } from '../scanner/repository-scanner';

describe('technology-detector', () => {
  it('detects frameworks from a nested package.json discovered in the repository tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-nested-'));

    try {
      const packageDirectory = path.join(tempRoot, 'packages', 'app');
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );

      const repositoryInfo: RepositoryInfo = {
        name: path.basename(tempRoot),
        rootPath: tempRoot,
        detectedFiles: fs.readdirSync(tempRoot),
        ignoredPaths: [],
      };

      const scanResult = scanRepository(repositoryInfo);
      repositoryInfo.repositoryTree = scanResult.tree;

      const profile = detectTechnologies(repositoryInfo);

      assert.ok(profile.frameworks.includes('React'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prefers the root package.json when both root and nested manifests exist', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-root-pkg-'));

    try {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ dependencies: { vue: '^3.0.0' } }),
      );

      const packageDirectory = path.join(tempRoot, 'packages', 'app');
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );

      const repositoryInfo: RepositoryInfo = {
        name: path.basename(tempRoot),
        rootPath: tempRoot,
        detectedFiles: fs.readdirSync(tempRoot),
        ignoredPaths: [],
      };

      const scanResult = scanRepository(repositoryInfo);
      repositoryInfo.repositoryTree = scanResult.tree;

      const profile = detectTechnologies(repositoryInfo);

      assert.ok(profile.frameworks.includes('Vue'));
      assert.equal(profile.frameworks.includes('React'), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
