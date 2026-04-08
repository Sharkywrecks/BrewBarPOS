import { DiscountType } from 'api-client';

export interface CartState {
  lineItems: CartLineItem[];
  notes: string | null;
  taxRate: number;
  orderDiscountAmount: number;
  orderDiscountType: DiscountType | null;
  orderDiscountPercent: number | null;
  orderDiscountReason: string | null;
}

export interface CartLineItem {
  localId: string;
  productId: number;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  discountAmount: number;
  discountType: DiscountType | null;
  discountPercent: number | null;
  discountReason: string | null;
  modifierItems: CartModifierItem[];
}

export interface CartModifierItem {
  modifierName: string;
  optionName: string;
  price: number;
}
