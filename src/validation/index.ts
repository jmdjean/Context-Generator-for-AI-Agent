import { ProjectKnowledge } from '../knowledge';
import {
  DocumentationValidationOptions,
  validateDocumentation,
} from './documentation-validator';
import { validateKnowledge } from './knowledge-validator';
import { buildValidationResult, ValidationResult } from './validation-result';

export {
  KEY_DOCUMENT_PATHS,
  validateDocumentation,
  type DocumentationValidationOptions,
} from './documentation-validator';
export { validateKnowledge } from './knowledge-validator';
export {
  buildValidationResult,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSeverity,
  type ValidationSummary,
} from './validation-result';

export function validateGeneratedOutputs(
  knowledge: ProjectKnowledge,
  options: DocumentationValidationOptions = {},
): ValidationResult {
  return buildValidationResult([
    ...validateKnowledge(knowledge),
    ...validateDocumentation(knowledge, options),
  ]);
}
