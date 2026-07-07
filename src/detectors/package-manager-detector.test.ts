import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectPackageManager } from './package-manager-detector';
import { RepositoryInfo } from '../domain';
import { scanRepository } from '../scanner/repository-scanner';

describe('package-manager-detector', () => {
  it('detects lockfiles discovered in the repository tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-nested-'));

    try {
      const packageDirectory = path.join(tempRoot, 'packages', 'app');
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(path.join(packageDirectory, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n');

      const repositoryInfo: RepositoryInfo = {
        name: path.basename(tempRoot),
        rootPath: tempRoot,
        detectedFiles: fs.readdirSync(tempRoot),
        ignoredPaths: [],
      };

      const scanResult = scanRepository(repositoryInfo);
      repositoryInfo.repositoryTree = scanResult.tree;

      assert.equal(detectPackageManager(repositoryInfo), 'pnpm');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
