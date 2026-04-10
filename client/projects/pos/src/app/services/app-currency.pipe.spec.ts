import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Currency } from 'api-client';
import { AppCurrencyPipe, CURRENCY_PROVIDER, CurrencyProvider } from 'ui';
import { getCurrencySymbol } from 'shared-models';

function makeCurrencyProvider(currency: Currency): CurrencyProvider {
  return {
    get currencySymbol() {
      return getCurrencySymbol(currency);
    },
  };
}

function createPipe(currency: Currency): AppCurrencyPipe {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AppCurrencyPipe,
      { provide: CURRENCY_PROVIDER, useValue: makeCurrencyProvider(currency) },
    ],
  });
  return TestBed.inject(AppCurrencyPipe);
}

describe('AppCurrencyPipe (POS)', () => {
  it('should format with SCR symbol when currency is SCR', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(150)).toBe('SCR 150.00');
  });

  it('should format with $ symbol when currency is USD', () => {
    const pipe = createPipe(Currency.USD);
    expect(pipe.transform(150)).toBe('$ 150.00');
  });

  it('should format with € symbol when currency is EUR', () => {
    const pipe = createPipe(Currency.EUR);
    expect(pipe.transform(99.5)).toBe('€ 99.50');
  });

  it('should return empty string for null', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should return empty string for NaN', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(NaN)).toBe('');
  });

  it('should format zero correctly', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(0)).toBe('SCR 0.00');
  });

  it('should format negative values with sign before symbol', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(-50)).toBe('-SCR 50.00');
  });

  it('should include thousands separators', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(1234.56)).toBe('SCR 1,234.56');
  });

  it('should round to two decimal places by default', () => {
    const pipe = createPipe(Currency.SCR);
    expect(pipe.transform(10.999)).toBe('SCR 11.00');
  });
});
