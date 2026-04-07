import { Component, input, output } from '@angular/core';
import { ProductDto } from 'api-client';
import { ProductCardComponent } from './product-card.component';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <div class="grid">
      @for (product of products(); track product.id) {
        <app-product-card [product]="product" (tap)="productSelected.emit($event)" />
      } @empty {
        <div class="empty-state">No products in this category</div>
      }
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        padding: 16px;
        overflow-y: auto;
        height: 100%;
      }
      .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 48px 16px;
        opacity: 0.5;
        font-size: 15px;
      }
    `,
  ],
})
export class ProductGridComponent {
  readonly products = input.required<ProductDto[]>();
  readonly productSelected = output<ProductDto>();
}
