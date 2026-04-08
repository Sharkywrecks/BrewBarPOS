import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CLIENT_TOKEN, IClient, ProductDto, ModifierDto } from 'api-client';

export interface ProductModifiersDialogData {
  product: ProductDto;
}

@Component({
  selector: 'app-product-modifiers-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Modifiers — {{ data.product.name }}</h2>
    <mat-dialog-content>
      @if (loading()) {
        <mat-spinner diameter="32"></mat-spinner>
      } @else {
        @for (mod of allModifiers(); track mod.id) {
          <mat-checkbox
            [checked]="isAssigned(mod.id!)"
            (change)="onToggle(mod.id!, $event.checked)"
            [disabled]="saving()"
          >
            {{ mod.name }}
            @if (mod.isRequired) {
              <span class="req">(required)</span>
            }
          </mat-checkbox>
        } @empty {
          <p>No modifiers defined. Create modifiers first.</p>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-checkbox {
        display: block;
        margin: 8px 0;
      }
      .req {
        font-size: 12px;
        opacity: 0.6;
        margin-left: 4px;
      }
    `,
  ],
})
export class ProductModifiersDialogComponent implements OnInit {
  protected readonly data = inject<ProductModifiersDialogData>(MAT_DIALOG_DATA);
  private readonly client = inject(CLIENT_TOKEN) as IClient;

  protected readonly allModifiers = signal<ModifierDto[]>([]);
  protected readonly assignedIds = signal<Set<number>>(new Set());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  async ngOnInit() {
    const mods = await firstValueFrom(this.client.modifiers_GetModifiers());
    this.allModifiers.set(mods);
    const assigned = new Set(this.data.product.modifiers?.map((m) => m.modifierId!) ?? []);
    this.assignedIds.set(assigned);
    this.loading.set(false);
  }

  protected isAssigned(id: number): boolean {
    return this.assignedIds().has(id);
  }

  protected async onToggle(modifierId: number, checked: boolean): Promise<void> {
    this.saving.set(true);
    try {
      if (checked) {
        await firstValueFrom(
          this.client.products_AssignModifier(this.data.product.id!, modifierId),
        );
      } else {
        await firstValueFrom(
          this.client.products_RemoveModifier(this.data.product.id!, modifierId),
        );
      }
      this.assignedIds.update((s) => {
        const next = new Set(s);
        if (checked) next.add(modifierId);
        else next.delete(modifierId);
        return next;
      });
    } finally {
      this.saving.set(false);
    }
  }
}
