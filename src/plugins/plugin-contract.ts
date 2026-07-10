export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
}

export type PluginKind = 'analyzer' | 'technology' | 'documentation' | 'exporter';

export interface Plugin extends PluginMetadata {
  readonly kind: PluginKind;
}
