import { Component, input, output } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { CategoryDto } from 'api-client';

@Component({
  selector: 'app-category-bar',
  standalone: true,
  imports: [MatTabsModule],
  template: `
    <mat-tab-group
      (selectedIndexChange)="onTabChange($event)"
      [selectedIndex]="selectedIndex()"
      mat-stretch-tabs="false"
    >
      @for (cat of categories(); track cat.id) {
        <mat-tab [label]="cat.name!"></mat-tab>
      }
    </mat-tab-group>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      ::ng-deep .mat-mdc-tab {
        min-width: 100px;
        height: 48px;
        font-size: 15px;
        font-weight: 500;
      }
    `,
  ],
})
export class CategoryBarComponent {
  readonly categories = input.required<CategoryDto[]>();
  readonly selectedIndex = input(0);
  readonly categorySelected = output<CategoryDto>();

  onTabChange(index: number): void {
    const cats = this.categories();
    if (cats[index]) {
      this.categorySelected.emit(cats[index]);
    }
  }
}
