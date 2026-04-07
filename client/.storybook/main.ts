import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: [
    '../projects/pos/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../projects/admin/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/ui/src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-links'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  docs: {},
};

export default config;
