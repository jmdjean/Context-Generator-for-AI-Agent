'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const SETTINGS_KEY = 'ai-project-docs-ui-settings';

  const form = document.getElementById('run-form');
  const runButton = document.getElementById('run-button');
  const browseButton = document.getElementById('browse-button');
  const clearSettingsButton = document.getElementById('clear-settings');
  const openDocsButton = document.getElementById('open-docs-button');
  const statusEl = document.getElementById('status');
  const bannerEl = document.getElementById('banner');
  const progressEl = document.getElementById('progress');
  const checklistEl = document.getElementById('checklist');
  const elapsedEl = document.getElementById('elapsed');
  const resultsEl = document.getElementById('results');
  const resultsHeadline = document.getElementById('results-headline');
  const resultsBody = document.getElementById('results-body');
  const docsPathRow = document.getElementById('docs-path-row');
  const docsPathEl = document.getElementById('docs-path');
  const enableAiCheckbox = document.getElementById('enableAiAnalysis');
  const aiOptions = document.getElementById('ai-options');
  const enableExportsCheckbox = document.getElementById('enableAgentExports');
  const exportOptions = document.getElementById('export-options');
  const providerSelect = document.getElementById('aiProvider');
  const modelInput = document.getElementById('aiModel');
  const apiKeyInput = document.getElementById('apiKey');
  const apiKeyLabel = document.getElementById('api-key-label');
  const pathInput = document.getElementById('targetProjectPath');
  const docsDirInput = document.getElementById('docsDir');

  let providersPayload = null;
  let elapsedTimerId = null;
  let runStartedAt = 0;
  let lastDocsPath = '';
  const stepElements = new Map();

  enableAiCheckbox.addEventListener('change', () => {
    aiOptions.hidden = !enableAiCheckbox.checked;
    saveSettings();
  });

  enableExportsCheckbox.addEventListener('change', () => {
    exportOptions.hidden = !enableExportsCheckbox.checked;
    saveSettings();
  });

  providerSelect.addEventListener('change', () => {
    applyProviderDefaults(providerSelect.value);
    saveSettings();
  });

  for (const input of [pathInput, docsDirInput, modelInput]) {
    input.addEventListener('change', () => {
      saveSettings();
    });
  }

  for (const radio of form.querySelectorAll('input[name="exportTarget"]')) {
    radio.addEventListener('change', () => {
      saveSettings();
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitRun();
  });

  browseButton.addEventListener('click', () => {
    void browseFolder();
  });

  clearSettingsButton.addEventListener('click', () => {
    clearSavedSettings();
  });

  openDocsButton.addEventListener('click', () => {
    void openDocsFolder();
  });

  void initialize();

  async function initialize() {
    await loadProviders();
    restoreSettings();
  }

  async function loadProviders() {
    try {
      const response = await fetch('/api/providers');
      if (!response.ok) {
        throw new Error(`Failed to load providers (HTTP ${response.status})`);
      }
      providersPayload = await response.json();
      renderProviders(providersPayload);
    } catch (error) {
      showBanner(
        'error',
        error instanceof Error ? error.message : 'Failed to load AI providers',
      );
    }
  }

  function renderProviders(payload) {
    providerSelect.replaceChildren();
    for (const provider of payload.providers || []) {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = provider.name;
      if (provider.id === payload.defaultProvider) {
        option.selected = true;
      }
      providerSelect.appendChild(option);
    }
    applyProviderDefaults(providerSelect.value || payload.defaultProvider);
  }

  function selectedProviderInfo(providerId) {
    return (providersPayload?.providers || []).find(
      (provider) => provider.id === providerId,
    );
  }

  function applyProviderDefaults(providerId, forceModel) {
    const provider = selectedProviderInfo(providerId);
    const fallbackModel =
      providersPayload?.defaultModel ||
      (providerId === 'openai' ? 'gpt-4.1-mini' : 'openai/gpt-4.1-mini');
    const defaultModel = provider?.defaultModel || fallbackModel;

    apiKeyLabel.textContent = provider ? `${provider.name} API key` : 'API key';
    apiKeyInput.placeholder = provider
      ? `${provider.name} API key`
      : 'Provider API key';

    const previousDefaults = (providersPayload?.providers || []).map(
      (item) => item.defaultModel,
    );
    if (
      forceModel ||
      !modelInput.value.trim() ||
      previousDefaults.includes(modelInput.value.trim()) ||
      modelInput.value.trim() === (providersPayload?.defaultModel || '')
    ) {
      modelInput.value = defaultModel;
    }
    modelInput.placeholder = defaultModel;
  }

  function readExportTarget() {
    const selected = form.querySelector('input[name="exportTarget"]:checked');
    return selected ? selected.value : 'generic';
  }

  function setExportTarget(value) {
    const radio = form.querySelector(`input[name="exportTarget"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  function loadSavedSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function restoreSettings() {
    const saved = loadSavedSettings();
    if (!saved) {
      return;
    }

    if (typeof saved.targetProjectPath === 'string') {
      pathInput.value = saved.targetProjectPath;
    }
    if (typeof saved.docsDir === 'string' && saved.docsDir.trim()) {
      docsDirInput.value = saved.docsDir;
    }
    if (typeof saved.enableAiAnalysis === 'boolean') {
      enableAiCheckbox.checked = saved.enableAiAnalysis;
      aiOptions.hidden = !saved.enableAiAnalysis;
    }
    if (typeof saved.enableAgentExports === 'boolean') {
      enableExportsCheckbox.checked = saved.enableAgentExports;
      exportOptions.hidden = !saved.enableAgentExports;
    }
    if (typeof saved.exportTarget === 'string') {
      setExportTarget(saved.exportTarget);
    }
    if (typeof saved.aiProvider === 'string') {
      const option = [...providerSelect.options].find(
        (item) => item.value === saved.aiProvider,
      );
      if (option) {
        providerSelect.value = saved.aiProvider;
        applyProviderDefaults(saved.aiProvider, false);
      }
    }
    if (typeof saved.aiModel === 'string' && saved.aiModel.trim()) {
      modelInput.value = saved.aiModel;
    }
  }

  function saveSettings() {
    const payload = {
      targetProjectPath: pathInput.value.trim(),
      docsDir: docsDirInput.value.trim() || '.ai-docs',
      enableAiAnalysis: enableAiCheckbox.checked,
      aiProvider: providerSelect.value,
      aiModel: modelInput.value.trim(),
      enableAgentExports: enableExportsCheckbox.checked,
      exportTarget: readExportTarget(),
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota / private mode failures.
    }
  }

  function clearSavedSettings() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch {
      // ignore
    }
    pathInput.value = '';
    docsDirInput.value = '.ai-docs';
    enableAiCheckbox.checked = false;
    aiOptions.hidden = true;
    enableExportsCheckbox.checked = false;
    exportOptions.hidden = true;
    setExportTarget('generic');
    apiKeyInput.value = '';
    if (providersPayload) {
      providerSelect.value = providersPayload.defaultProvider || 'openrouter';
      applyProviderDefaults(providerSelect.value, true);
    }
    showBanner('success', 'Saved settings cleared. API keys were never stored.');
  }

  async function browseFolder() {
    clearBanner();
    browseButton.disabled = true;
    try {
      const response = await fetch('/api/browse-folder', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 501) {
        showBanner(
          'warning',
          typeof payload.error === 'string'
            ? payload.error
            : 'Native browse is not available on this platform. Paste a path instead.',
        );
        return;
      }

      if (!response.ok) {
        showBanner(
          'error',
          typeof payload.error === 'string'
            ? payload.error
            : `Browse failed (HTTP ${response.status})`,
        );
        return;
      }

      if (payload.cancelled) {
        return;
      }

      if (typeof payload.path === 'string' && payload.path.length > 0) {
        pathInput.value = payload.path;
        pathInput.focus();
        saveSettings();
      }
    } catch (error) {
      showBanner(
        'error',
        error instanceof Error ? error.message : 'Network error while browsing',
      );
    } finally {
      browseButton.disabled = false;
    }
  }

  async function openDocsFolder() {
    if (!lastDocsPath) {
      showBanner('error', 'No docs folder path is available yet.');
      return;
    }

    openDocsButton.disabled = true;
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: lastDocsPath }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showBanner(
          'error',
          typeof payload.error === 'string'
            ? payload.error
            : `Failed to open folder (HTTP ${response.status})`,
        );
        return;
      }
      showBanner('success', 'Opened docs folder in the file manager.');
    } catch (error) {
      showBanner(
        'error',
        error instanceof Error ? error.message : 'Network error while opening folder',
      );
    } finally {
      openDocsButton.disabled = false;
    }
  }

  async function submitRun() {
    clearBanner();
    resultsEl.hidden = true;
    resultsBody.replaceChildren();
    docsPathRow.hidden = true;
    lastDocsPath = '';
    resetProgress();

    const targetProjectPath = pathInput.value.trim();
    if (!targetProjectPath) {
      showBanner('error', 'Project folder is required.');
      pathInput.focus();
      return;
    }

    const enableAiAnalysis = enableAiCheckbox.checked;
    const providerId = providerSelect.value;
    const apiKey = apiKeyInput.value;
    const selectedProvider = selectedProviderInfo(providerId);

    if (enableAiAnalysis && selectedProvider?.requiresApiKey && !apiKey.trim()) {
      showBanner(
        'error',
        `${selectedProvider.name} API key is required when AI analysis is enabled.`,
      );
      apiKeyInput.focus();
      return;
    }

    const body = {
      targetProjectPath,
      docsDir: docsDirInput.value.trim() || '.ai-docs',
      enableAiAnalysis,
    };

    if (enableAiAnalysis) {
      body.aiProvider = providerId;
      const model = modelInput.value.trim();
      if (model) {
        body.aiModel = model;
      }
      if (apiKey.trim()) {
        body.apiKeys = { [providerId]: apiKey.trim() };
      }
    }

    if (enableExportsCheckbox.checked) {
      body.enableAgentExports = true;
      body.exportTargets = readExportTarget();
    }

    saveSettings();
    setLoading(true);
    startElapsedTimer();
    progressEl.hidden = false;

    try {
      const response = await fetch('/api/run?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : `Request failed (HTTP ${response.status})`;
        showBanner('error', message);
        return;
      }

      if (!contentType.includes('text/event-stream') || !response.body) {
        showBanner('error', 'Expected a progress stream from the server.');
        return;
      }

      const donePayload = await readSseStream(response.body);
      if (!donePayload) {
        showBanner('error', 'Run finished without a summary event.');
        return;
      }

      renderResults(donePayload);
    } catch (error) {
      showBanner(
        'error',
        error instanceof Error ? error.message : 'Network error while running analysis',
      );
    } finally {
      stopElapsedTimer();
      setLoading(false);
    }
  }

  async function readSseStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const event = parseSseChunk(part);
        if (!event) {
          continue;
        }
        if (event.type === 'step') {
          updateChecklistStep(event.name, event.status);
        } else if (event.type === 'done') {
          donePayload = event;
        } else if (event.type === 'error') {
          throw new Error(
            typeof event.message === 'string' ? event.message : 'Pipeline stream error',
          );
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseChunk(buffer);
      if (event?.type === 'done') {
        donePayload = event;
      } else if (event?.type === 'step') {
        updateChecklistStep(event.name, event.status);
      }
    }

    return donePayload;
  }

  function parseSseChunk(chunk) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }
      const raw = trimmed.slice(5).trim();
      if (!raw) {
        continue;
      }
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  function resetProgress() {
    stepElements.clear();
    checklistEl.replaceChildren();
    elapsedEl.textContent = 'Elapsed: 0s';
    progressEl.hidden = true;
  }

  function updateChecklistStep(name, status) {
    let item = stepElements.get(name);
    if (!item) {
      item = document.createElement('li');
      item.dataset.name = name;
      checklistEl.appendChild(item);
      stepElements.set(name, item);
    }

    const icon =
      status === 'completed'
        ? '✓'
        : status === 'skipped'
          ? '○'
          : status === 'failed'
            ? '✗'
            : '…';
    item.className = `checklist-item is-${status}`;
    item.textContent = `${icon} ${name}`;
  }

  function startElapsedTimer() {
    stopElapsedTimer();
    runStartedAt = Date.now();
    elapsedEl.textContent = 'Elapsed: 0s';
    elapsedTimerId = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - runStartedAt) / 1000);
      elapsedEl.textContent = `Elapsed: ${seconds}s`;
    }, 250);
  }

  function stopElapsedTimer() {
    if (elapsedTimerId !== null) {
      window.clearInterval(elapsedTimerId);
      elapsedTimerId = null;
    }
    if (runStartedAt > 0) {
      const seconds = Math.floor((Date.now() - runStartedAt) / 1000);
      elapsedEl.textContent = `Elapsed: ${seconds}s`;
    }
  }

  function renderResults(payload) {
    const summary = payload.summary || {};
    resultsEl.hidden = false;
    resultsHeadline.textContent = summary.headline || 'Run finished';

    if (payload.docsPath) {
      lastDocsPath = payload.docsPath;
      docsPathRow.hidden = false;
      docsPathEl.textContent = `Docs folder: ${payload.docsPath}`;
    } else {
      lastDocsPath = '';
      docsPathRow.hidden = true;
    }

    const sections = [];

    sections.push(
      section('Project', [
        `Name: ${summary.projectName || '—'}`,
        `Target: ${summary.targetProjectPath || '—'}`,
        `Docs dir: ${summary.docsDir || '—'}`,
        `Duration: ${summary.durationLabel || '—'}`,
        `Exit code: ${payload.exitCode ?? '—'}`,
      ]),
    );

    if (summary.pipeline) {
      sections.push(
        section('Pipeline', [
          `Completed: ${summary.pipeline.completed}`,
          `Skipped: ${summary.pipeline.skipped}`,
          `Failed: ${summary.pipeline.failed}`,
        ]),
      );
    }

    if (Array.isArray(summary.technologies) && summary.technologies.length > 0) {
      sections.push(section('Technologies', summary.technologies));
    } else {
      sections.push(section('Technologies', ['None detected']));
    }

    if (summary.knowledge) {
      sections.push(
        section('Knowledge', [
          `Repository tree: ${summary.knowledge.repositoryTreeGenerated ? 'generated' : 'not generated'}`,
          `Files scanned: ${summary.knowledge.filesScanned}`,
          `Folders analyzed: ${summary.knowledge.foldersAnalyzed}`,
          `Modules discovered: ${summary.knowledge.modulesDiscovered}`,
          `Dependency edges: ${summary.knowledge.dependencyEdges}`,
          `Conventions detected: ${summary.knowledge.conventionsDetected}`,
          `Navigation entries: ${summary.knowledge.navigationEntries}`,
          `Knowledge files persisted: ${summary.knowledge.knowledgeFilesPersisted}`,
        ]),
      );
    }

    if (summary.documentation) {
      const docs = summary.documentation;
      const lines = [`Planned: ${docs.planned}`, `Written: ${docs.written}`];
      if (docs.skippedUnchanged !== undefined) {
        lines.push(`Skipped unchanged: ${docs.skippedUnchanged}`);
      }
      if (docs.skippedProtected !== undefined) {
        lines.push(`Skipped protected: ${docs.skippedProtected}`);
      }
      sections.push(section('Documentation', lines));
    }

    if (summary.agentExports) {
      const exports = summary.agentExports;
      const lines = [
        `Targets: ${(exports.targets || []).join(', ') || '—'}`,
        `Files written: ${exports.filesWritten ?? 0}`,
        `Files skipped: ${exports.filesSkipped ?? 0}`,
      ];
      for (const warning of exports.warnings || []) {
        lines.push(`Warning: ${warning}`);
      }
      sections.push(section('Agent exporters', lines));
    }

    if (summary.aiReadiness) {
      sections.push(
        section('AI Readiness', [
          `Score: ${summary.aiReadiness.overallScore}/100`,
          `Level: ${summary.aiReadiness.level}`,
          `Critical gaps: ${summary.aiReadiness.criticalGaps}`,
          `Recommendations: ${summary.aiReadiness.recommendations}`,
        ]),
      );
    }

    if (summary.validation) {
      const validationLines = [`Status: ${summary.validation.status}`];
      if (summary.validation.errorCount !== undefined) {
        validationLines.push(`Errors: ${summary.validation.errorCount}`);
      }
      if (summary.validation.warningCount !== undefined) {
        validationLines.push(`Warnings: ${summary.validation.warningCount}`);
      }
      for (const detail of summary.validation.details || []) {
        const path = detail.relativePath ? ` (${detail.relativePath})` : '';
        validationLines.push(`${detail.severity}: ${detail.message}${path}`);
      }
      sections.push(section('Validation', validationLines));
    }

    if (Array.isArray(summary.errors) && summary.errors.length > 0) {
      sections.push(
        section(
          'Errors',
          summary.errors.map((item) => `${item.stepName}: ${item.message}`),
        ),
      );
    }

    if (Array.isArray(summary.nextSteps) && summary.nextSteps.length > 0) {
      sections.push(section('Next steps', summary.nextSteps));
    }

    if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
      sections.push(section('Warnings', payload.warnings));
    }

    resultsBody.replaceChildren(...sections);

    if (payload.exitCode === 0) {
      showBanner('success', 'Analysis completed successfully.');
    } else {
      showBanner(
        'warning',
        `Analysis finished with exit code ${payload.exitCode}. Review the results below.`,
      );
    }
  }

  function section(title, lines) {
    const wrap = document.createElement('div');
    wrap.className = 'result-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    wrap.appendChild(heading);

    if (!lines || lines.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'No details.';
      wrap.appendChild(empty);
      return wrap;
    }

    const list = document.createElement('ul');
    for (const line of lines) {
      const item = document.createElement('li');
      item.textContent = String(line);
      list.appendChild(item);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function setLoading(isLoading) {
    runButton.disabled = isLoading;
    browseButton.disabled = isLoading;
    openDocsButton.disabled = isLoading;
    clearSettingsButton.disabled = isLoading;
    statusEl.classList.toggle('is-loading', isLoading);
    statusEl.textContent = isLoading ? 'Running analysis…' : '';
  }

  function showBanner(kind, message) {
    bannerEl.hidden = false;
    bannerEl.className = `banner is-${kind}`;
    bannerEl.textContent = message;
  }

  function clearBanner() {
    bannerEl.hidden = true;
    bannerEl.textContent = '';
    bannerEl.className = 'banner';
  }
});
