import path from 'node:path';
import { appConfig } from '../config.js';
import { TeamMemory } from './team-memory.js';

/** The platform's team memory: `<dataDir>/memory.md`, seeded from `agent/memory.default.md`. */
export const teamMemory = new TeamMemory(
  path.join(appConfig.dataDir, 'memory.md'),
  path.join(appConfig.agent.dir, 'memory.default.md'),
);
