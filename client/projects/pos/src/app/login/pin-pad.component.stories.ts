import type { Meta, StoryObj } from '@storybook/angular';
import { PinPadComponent } from './pin-pad.component';

const meta: Meta<PinPadComponent> = {
  title: 'POS/PinPad',
  component: PinPadComponent,
  tags: ['autodocs'],
  argTypes: {
    error: { control: 'text' },
    loading: { control: 'boolean' },
    maxLength: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<PinPadComponent>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    error: 'Invalid PIN. Please try again.',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const ShortPin: Story = {
  args: {
    maxLength: 4,
  },
};
