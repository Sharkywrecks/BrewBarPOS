export interface CartState {
  lineItems: CartLineItem[];
  notes: string | null;
  taxRate: number;
}

export interface CartLineItem {
  localId: string;
  productId: number;
  productName: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  modifierItems: CartModifierItem[];
}

export interface CartModifierItem {
  modifierName: string;
  optionName: string;
  price: number;
}
