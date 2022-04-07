import * as dotenv from 'dotenv';

dotenv.config();

const parseURL = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch (e) {
    console.error(e);
    return null;
  }
}

const parseString = (str: string): string | null => {
  if (!str || !str.trim()) return null;
  return str;
}

export interface Config {

}

const config: Config = {

}

export default config;
export const validConfig = !!(config);
