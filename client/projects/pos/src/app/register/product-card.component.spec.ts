import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { ProductCardComponent } from './product-card.component';
import { ProductDto, Currency } from 'api-client';
import { SettingsService } from '../services/settings.service';

const settingsStub = {
  settings: () => ({ storeName: 'Test', taxRate: 0.15, currency: Currency.SCR }),
  get currencySymbol() {
    return 'SCR ';
  },
};

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 1,
    name: 'Green Machine',
    basePrice: 8.5,
    isAvailable: true,
    variants: [],
    ...overrides,
  } as ProductDto;
}

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;
  let componentRef: ComponentRef<ProductCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [{ provide: SettingsService, useValue: settingsStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    componentRef = fixture.componentRef;
  });

  it('should create', () => {
    componentRef.setInput('product', makeProduct());
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display product name', () => {
    componentRef.setInput('product', makeProduct({ name: 'Tropical Blast' }));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tropical Blast');
  });

  it('should display formatted price', () => {
    componentRef.setInput('product', makeProduct({ basePrice: 8.5 }));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('SCR 8.50');
  });

  it('should show variant count when variants exist', () => {
    componentRef.setInput(
      'product',
      makeProduct({
        variants: [
          { id: 1, name: '16 oz', priceOverride: 7.0 } as any,
          { id: 2, name: '24 oz', priceOverride: 9.5 } as any,
        ],
      }),
    );
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2 sizes');
  });

  it('should not show variant hint when no variants', () => {
    componentRef.setInput('product', makeProduct({ variants: [] }));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('sizes');
  });

  it('should emit tap on click when available', () => {
    const product = makeProduct();
    componentRef.setInput('product', product);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(fixture.componentInstance.tap, 'emit');
    fixture.componentInstance.onTap();

    expect(emitSpy).toHaveBeenCalledWith(product);
  });

  it('should not emit tap when unavailable', () => {
    componentRef.setInput('product', makeProduct({ isAvailable: false }));
    fixture.detectChanges();

    const emitSpy = vi.spyOn(fixture.componentInstance.tap, 'emit');
    fixture.componentInstance.onTap();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should apply unavailable class when not available', () => {
    componentRef.setInput('product', makeProduct({ isAvailable: false }));
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.product-card');
    expect(card?.classList.contains('unavailable')).toBe(true);
  });
});
