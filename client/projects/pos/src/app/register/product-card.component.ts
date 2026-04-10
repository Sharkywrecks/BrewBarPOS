import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { AppCurrencyPipe } from 'ui';
import { ProductDto } from 'api-client';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [MatCardModule, MatRippleModule, AppCurrencyPipe],
  template: `
    <mat-card
      class="product-card"
      [class.unavailable]="!product().isAvailable"
      matRipple
      (click)="onTap()"
    >
      <mat-card-content>
        <div class="product-name">{{ product().name }}</div>
        <div class="product-price">{{ product().basePrice | appCurrency }}</div>
        @if (product().variants && product().variants!.length > 0) {
          <div class="variant-hint">{{ product().variants!.length }} sizes</div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .product-card {
        cursor: pointer;
        height: 100%;
        min-height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition:
          box-shadow 0.2s,
          transform 0.1s;
        user-select: none;
        -webkit-user-select: none;
        border-radius: 12px;
        padding: 4px;
      }
      .product-card:active {
        box-shadow: none;
        transform: scale(0.97);
      }
      .product-card.unavailable {
        opacity: 0.35;
        pointer-events: none;
      }
      .product-name {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }
      .product-price {
        font-size: 13px;
        opacity: 0.6;
        margin-top: 6px;
        font-weight: 500;
      }
      .variant-hint {
        font-size: 11px;
        opacity: 0.45;
        margin-top: 3px;
        font-style: italic;
      }
    `,
  ],
})
export class ProductCardComponent {
  readonly product = input.required<ProductDto>();
  readonly tap = output<ProductDto>();

  onTap(): void {
    if (this.product().isAvailable) {
      this.tap.emit(this.product());
    }
  }
}
