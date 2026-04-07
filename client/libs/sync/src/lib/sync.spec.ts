import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Sync } from './sync';

describe('Sync component', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({
      imports: [Sync],
    }).compileComponents();

    const fixture = TestBed.createComponent(Sync);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [Sync],
    }).compileComponents();

    const fixture = TestBed.createComponent(Sync);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('sync works!');
  });
});
