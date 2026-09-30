import path from 'node:path';
import config from 'config';

export interface AppConfig {
  port: number;
  /** Absolute path to the compiled Angular app (the `browser` output folder). */
  clientDist: string;
}

/**
 * Typed view over `config/<NODE_CONFIG_ENV>.json`.
 * `clientDist` in the JSON is relative to the server's working directory (`server/`).
 */
export const appConfig: AppConfig = {
  port: config.get<number>('port'),
  clientDist: path.resolve(config.get<string>('clientDist')),
};
