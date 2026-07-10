import { TechnologyPlugin } from '../technology-plugin';
import { angularPlugin } from './angular-plugin';
import { nestPlugin } from './nest-plugin';
import { nodePlugin } from './node-plugin';
import { reactPlugin } from './react-plugin';

export const TECHNOLOGY_PLUGINS: ReadonlyArray<TechnologyPlugin> = [
  angularPlugin,
  reactPlugin,
  nestPlugin,
  nodePlugin,
];
