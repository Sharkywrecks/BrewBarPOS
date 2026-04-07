import type { Meta, StoryObj } from '@storybook/angular';
import { ProductCardComponent } from './product-card.component';

const meta: Meta<ProductCardComponent> = {
  title: 'POS/ProductCard',
  component: ProductCardComponent,
  tags: ['autodocs'],
  decorators: [],
};

export default meta;
type Story = StoryObj<ProductCardComponent>;

export const Default: Story = {
  args: {
    product: {
      id: 1,
      name: 'Green Machine',
      basePrice: 8.5,
      isAvailable: true,
      variants: [],
    },
  },
};

export const WithVariants: Story = {
  args: {
    product: {
      id: 2,
      name: 'Tropical Blast',
      basePrice: 7.0,
      isAvailable: true,
      variants: [
        { id: 1, name: '16 oz', priceOverride: 7.0 },
        { id: 2, name: '24 oz', priceOverride: 9.5 },
      ],
    },
  },
};

export const Unavailable: Story = {
  args: {
    product: {
      id: 3,
      name: 'Berry Detox',
      basePrice: 9.0,
      isAvailable: false,
      variants: [],
    },
  },
};
