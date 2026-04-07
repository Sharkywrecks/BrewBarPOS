import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { PinPadComponent } from './pin-pad.component';

describe('PinPadComponent', () => {
  let component: PinPadComponent;
  let fixture: ComponentFixture<PinPadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinPadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PinPadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display 10 number keys', () => {
    expect(component.keys).toHaveLength(10);
    expect(component.keys).toContain('0');
    expect(component.keys).toContain('9');
  });

  it('should append digit on key press', () => {
    component.onKey('1');
    component.onKey('2');

    expect(component['pin']()).toBe('12');
  });

  it('should not exceed maxLength', () => {
    // Default maxLength is 6
    for (let i = 0; i < 8; i++) {
      component.onKey('1');
    }

    expect(component['pin']()).toHaveLength(6);
  });

  it('should emit pinSubmit when 4 digits entered', () => {
    const emitSpy = vi.spyOn(component.pinSubmit, 'emit');

    component.onKey('1');
    component.onKey('2');
    component.onKey('3');
    expect(emitSpy).not.toHaveBeenCalled();

    component.onKey('4');
    expect(emitSpy).toHaveBeenCalledWith('1234');
  });

  it('should remove last digit on backspace', () => {
    component.onKey('1');
    component.onKey('2');
    component.onKey('3');
    component.onBackspace();

    expect(component['pin']()).toBe('12');
  });

  it('should do nothing on backspace when empty', () => {
    component.onBackspace();
    expect(component['pin']()).toBe('');
  });

  it('should reset pin', () => {
    component.onKey('1');
    component.onKey('2');
    component.reset();

    expect(component['pin']()).toBe('');
  });

  it('should update dots to match pin length', () => {
    component.onKey('1');
    component.onKey('2');

    expect(component['pinDigits']()).toHaveLength(2);
    expect(component['emptyDots']()).toHaveLength(4); // maxLength 6 - 2 entered
  });
});
