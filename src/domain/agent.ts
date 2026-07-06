export interface AgentInstruction {
  title: string;
  scope: string;
  instructions: string[];
  relatedDocuments: string[];
}
