import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideZonelessChangeDetection } from '@angular/core';
import { CLIENT_TOKEN, ProductDto, ProductModifierDto } from 'api-client';
import { RegisterPage } from './register.page';
import { CartStore } from '../store/cart.store';
import { MenuService } from '../services/menu.service';
import { SettingsService } from '../services/settings.service';

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 1,
    name: 'Mojito',
    basePrice: 150,
    isAvailable: true,
    taxRate: 0.15,
    variants: [],
    modifiers: [],
    ...overrides,
  } as ProductDto;
}

function makeModifier(overrides: Partial<ProductModifierDto> = {}): ProductModifierDto {
  return {
    modifierId: 1,
    modifierName: 'Virgin Variant',
    isRequired: false,
    allowMultiple: false,
    sortOrder: 0,
    options: [{ id: 1, name: 'Make Virgin', price: -50, sortOrder: 0 }],
    ...overrides,
  } as ProductModifierDto;
}

describe('RegisterPage.onProductSelected', () => {
  let page: RegisterPage;
  let cart: { addItem: ReturnType<typeof vi.fn> };
  let bottomSheet: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cart = { addItem: vi.fn() };
    bottomSheet = {
      open: vi.fn().mockReturnValue({ afterDismissed: () => ({ subscribe: vi.fn() }) }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        RegisterPage,
        { provide: CartStore, useValue: cart },
        { provide: MatBottomSheet, useValue: bottomSheet },
        {
          provide: MenuService,
          useValue: {
            categories: () => [],
            loading: () => false,
            loadCategories: vi.fn(),
            selectCategory: vi.fn(),
            getProducts: () => [],
          },
        },
        {
          provide: SettingsService,
          useValue: { taxRate: 0.15, settings: () => ({ taxRate: 0.15 }) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: CLIENT_TOKEN, useValue: {} },
      ],
    });

    page = TestBed.inject(RegisterPage);
  });

  it('should add directly to cart when product has no modifiers and no variants', () => {
    const product = makeProduct();
    page.onProductSelected(product);

    expect(cart.addItem).toHaveBeenCalledTimes(1);
    expect(bottomSheet.open).not.toHaveBeenCalled();
  });

  it('should open modifier sheet when product has an OPTIONAL modifier (regression for cocktail Virgin Variant bug)', () => {
    const product = makeProduct({
      name: 'Mojito',
      modifiers: [makeModifier({ isRequired: false })],
    });

    page.onProductSelected(product);

    expect(bottomSheet.open).toHaveBeenCalledTimes(1);
    expect(cart.addItem).not.toHaveBeenCalled();
  });

  it('should open modifier sheet when product has a REQUIRED modifier', () => {
    const product = makeProduct({
      modifiers: [makeModifier({ isRequired: true })],
    });

    page.onProductSelected(product);

    expect(bottomSheet.open).toHaveBeenCalledTimes(1);
    expect(cart.addItem).not.toHaveBeenCalled();
  });

  it('should open modifier sheet when product has variants', () => {
    const product = makeProduct({
      variants: [
        { id: 1, name: 'Small', priceOverride: 100, sortOrder: 0, isAvailable: true },
        { id: 2, name: 'Large', priceOverride: 200, sortOrder: 1, isAvailable: true },
      ],
    });

    page.onProductSelected(product);

    expect(bottomSheet.open).toHaveBeenCalledTimes(1);
    expect(cart.addItem).not.toHaveBeenCalled();
  });
});
