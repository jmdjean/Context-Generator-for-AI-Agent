import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { detectTechnologies } from './technology-detector';
import { RepositoryInfo } from '../domain';
import { scanRepository } from '../scanner/repository-scanner';

function scanTempRepository(tempRoot: string): RepositoryInfo {
  const repositoryInfo: RepositoryInfo = {
    name: path.basename(tempRoot),
    rootPath: tempRoot,
    detectedFiles: fs.readdirSync(tempRoot),
    ignoredPaths: [],
  };
  const scanResult = scanRepository(repositoryInfo);
  repositoryInfo.repositoryTree = scanResult.tree;
  return repositoryInfo;
}

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

      const profile = detectTechnologies(scanTempRepository(tempRoot));

      assert.ok(profile.frameworks.includes('React'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('aggregates frameworks from root and nested package.json manifests', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-aggregate-'));

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

      const profile = detectTechnologies(scanTempRepository(tempRoot));

      assert.ok(profile.frameworks.includes('Vue'));
      assert.ok(profile.frameworks.includes('React'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('detects Express from a nested bridge-server package.json', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-bridge-'));

    try {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ name: 'smart-phone', private: true }),
      );
      fs.writeFileSync(path.join(tempRoot, 'tsconfig.json'), '{"compilerOptions":{}}');

      const bridgeDirectory = path.join(tempRoot, 'bridge-server');
      fs.mkdirSync(bridgeDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(bridgeDirectory, 'package.json'),
        JSON.stringify({
          name: 'bridge-server',
          dependencies: { express: '^4.18.0' },
        }),
      );

      const profile = detectTechnologies(scanTempRepository(tempRoot));

      assert.ok(profile.languages.includes('TypeScript'));
      assert.ok(profile.frameworks.includes('Express'));
      assert.equal(profile.frameworks.includes('Angular'), false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('detects Java from a nested pom.xml without inventing frameworks', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-java-'));

    try {
      const serviceDirectory = path.join(tempRoot, 'services', 'orders');
      fs.mkdirSync(serviceDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(serviceDirectory, 'pom.xml'),
        `<?xml version="1.0"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>orders</artifactId>
</project>
`,
      );

      const profile = detectTechnologies(scanTempRepository(tempRoot));

      assert.ok(profile.languages.includes('Java'));
      assert.deepEqual(profile.frameworks, []);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('detects C# from a nested csproj manifest', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-csharp-'));

    try {
      const appDirectory = path.join(tempRoot, 'apps', 'desktop');
      fs.mkdirSync(appDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(appDirectory, 'DesktopApp.csproj'),
        '<Project Sdk="Microsoft.NET.Sdk"></Project>\n',
      );

      const profile = detectTechnologies(scanTempRepository(tempRoot));

      assert.ok(profile.languages.includes('C#'));
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
