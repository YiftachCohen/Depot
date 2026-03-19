import { describe, it, expect, afterEach } from 'bun:test';
import { isDevRuntime, isDeveloperFeedbackEnabled, isCraftAgentsCliEnabled } from '../feature-flags.ts';

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  DEPOT_DEBUG: process.env.DEPOT_DEBUG,
  CRAFT_DEBUG: process.env.CRAFT_DEBUG,
  DEPOT_FEATURE_DEVELOPER_FEEDBACK: process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK,
  CRAFT_FEATURE_DEVELOPER_FEEDBACK: process.env.CRAFT_FEATURE_DEVELOPER_FEEDBACK,
  DEPOT_FEATURE_DEPOT_CLI: process.env.DEPOT_FEATURE_DEPOT_CLI,
  CRAFT_FEATURE_CRAFT_AGENTS_CLI: process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI,
};

afterEach(() => {
  if (ORIGINAL_ENV.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;

  if (ORIGINAL_ENV.DEPOT_DEBUG === undefined) delete process.env.DEPOT_DEBUG;
  else process.env.DEPOT_DEBUG = ORIGINAL_ENV.DEPOT_DEBUG;

  if (ORIGINAL_ENV.CRAFT_DEBUG === undefined) delete process.env.CRAFT_DEBUG;
  else process.env.CRAFT_DEBUG = ORIGINAL_ENV.CRAFT_DEBUG;

  if (ORIGINAL_ENV.DEPOT_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.DEPOT_FEATURE_DEVELOPER_FEEDBACK;

  if (ORIGINAL_ENV.CRAFT_FEATURE_DEVELOPER_FEEDBACK === undefined) delete process.env.CRAFT_FEATURE_DEVELOPER_FEEDBACK;
  else process.env.CRAFT_FEATURE_DEVELOPER_FEEDBACK = ORIGINAL_ENV.CRAFT_FEATURE_DEVELOPER_FEEDBACK;

  if (ORIGINAL_ENV.DEPOT_FEATURE_DEPOT_CLI === undefined) delete process.env.DEPOT_FEATURE_DEPOT_CLI;
  else process.env.DEPOT_FEATURE_DEPOT_CLI = ORIGINAL_ENV.DEPOT_FEATURE_DEPOT_CLI;

  if (ORIGINAL_ENV.CRAFT_FEATURE_CRAFT_AGENTS_CLI === undefined) delete process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI;
  else process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI = ORIGINAL_ENV.CRAFT_FEATURE_CRAFT_AGENTS_CLI;
});

describe('feature-flags runtime helpers', () => {
  it('isDevRuntime returns true for explicit dev NODE_ENV', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEPOT_DEBUG;
    delete process.env.CRAFT_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for DEPOT_DEBUG override', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEPOT_DEBUG = '1';
    delete process.env.CRAFT_DEBUG;

    expect(isDevRuntime()).toBe(true);
  });

  it('isDevRuntime returns true for CRAFT_DEBUG fallback', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEPOT_DEBUG;
    process.env.CRAFT_DEBUG = '1';

    expect(isDevRuntime()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled honors explicit override false', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK = '0';

    expect(isDeveloperFeedbackEnabled()).toBe(false);
  });

  it('isDeveloperFeedbackEnabled honors explicit override true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DEPOT_DEBUG;
    delete process.env.CRAFT_DEBUG;
    process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK = '1';

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isDeveloperFeedbackEnabled falls back to dev runtime when no override', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEPOT_DEBUG = '1';
    delete process.env.DEPOT_FEATURE_DEVELOPER_FEEDBACK;
    delete process.env.CRAFT_FEATURE_DEVELOPER_FEEDBACK;

    expect(isDeveloperFeedbackEnabled()).toBe(true);
  });

  it('isCraftAgentsCliEnabled defaults to false when no override is set', () => {
    delete process.env.DEPOT_FEATURE_DEPOT_CLI;
    delete process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI;

    expect(isCraftAgentsCliEnabled()).toBe(false);
  });

  it('isCraftAgentsCliEnabled honors explicit override true', () => {
    process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI = '1';

    expect(isCraftAgentsCliEnabled()).toBe(true);
  });

  it('isCraftAgentsCliEnabled honors explicit override false', () => {
    process.env.CRAFT_FEATURE_CRAFT_AGENTS_CLI = '0';

    expect(isCraftAgentsCliEnabled()).toBe(false);
  });
});
