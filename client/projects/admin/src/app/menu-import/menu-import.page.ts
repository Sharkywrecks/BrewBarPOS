import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CLIENT_TOKEN, FileResponse, IClient, MenuImportResult, extractApiError } from 'api-client';

@Component({
  selector: 'app-menu-import',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h1>Menu Import</h1>

    <mat-card class="card">
      <mat-card-header>
        <mat-card-title>Bulk import from Excel</mat-card-title>
        <mat-card-subtitle>
          Upload an .xlsx file with Categories, Products, Modifiers and ProductModifiers sheets.
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <ol class="steps">
          <li>Download the template below if you don't have one yet.</li>
          <li>Fill in your menu data in the appropriate sheets.</li>
          <li>
            Leave the <strong>Id</strong> column blank to create new records. To
            <strong>update</strong> an existing product or modifier (rename, change price, etc.),
            fill in its Id and the row will overwrite the existing record.
          </li>
          <li>
            Upload the .xlsx file. Records without an Id are matched by name and skipped if they
            already exist.
          </li>
        </ol>

        <div class="actions">
          <button mat-stroked-button (click)="downloadTemplate()">
            <mat-icon>download</mat-icon>
            Download Template
          </button>

          <button mat-stroked-button (click)="exportCatalog()" [disabled]="exporting()">
            <mat-icon>file_download</mat-icon>
            {{ exporting() ? 'Exporting…' : 'Export Current Catalog' }}
          </button>

          <input
            #fileInput
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            (change)="onFileSelected($event)"
          />
          <button
            mat-flat-button
            color="primary"
            (click)="fileInput.click()"
            [disabled]="uploading()"
          >
            <mat-icon>upload_file</mat-icon>
            {{ uploading() ? 'Importing…' : 'Choose File & Import' }}
          </button>
          @if (uploading()) {
            <mat-spinner diameter="24"></mat-spinner>
          }
        </div>
      </mat-card-content>
    </mat-card>

    @if (result(); as r) {
      <mat-card class="card result-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="success">check_circle</mat-icon>
            Import Complete
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="result-grid">
            <div class="result-item">
              <div class="result-value">{{ r.categoriesCreated }}</div>
              <div class="result-label">Categories created</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ r.productsCreated }}</div>
              <div class="result-label">Products created</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ r.productsUpdated }}</div>
              <div class="result-label">Products updated</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ r.modifiersCreated }}</div>
              <div class="result-label">Modifiers created</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ r.modifiersUpdated }}</div>
              <div class="result-label">Modifiers updated</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ r.productModifierLinksCreated }}</div>
              <div class="result-label">Modifier links</div>
            </div>
          </div>

          @if ((r.errors?.length ?? 0) > 0) {
            <div class="errors">
              <h3>
                <mat-icon class="warn">warning</mat-icon>
                {{ r.errors!.length }} warning(s)
              </h3>
              <ul>
                @for (e of r.errors!; track e) {
                  <li>{{ e }}</li>
                }
              </ul>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [
    `
      .card {
        max-width: 720px;
        margin-bottom: 16px;
      }
      .steps {
        margin: 16px 0;
        padding-left: 20px;
        font-size: 14px;
        line-height: 1.6;
      }
      .actions {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .result-card .success {
        color: #2e7d32;
        vertical-align: middle;
      }
      .result-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .result-item {
        text-align: center;
        padding: 16px;
        background: var(--mat-sys-surface-container);
        border-radius: 8px;
      }
      .result-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--mat-sys-primary);
      }
      .result-label {
        font-size: 12px;
        opacity: 0.7;
      }
      .errors {
        margin-top: 16px;
        padding: 12px 16px;
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        border-radius: 8px;
      }
      .errors h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-size: 14px;
      }
      .errors .warn {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .errors ul {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        max-height: 240px;
        overflow-y: auto;
      }
    `,
  ],
})
export class MenuImportPage {
  private readonly client = inject<IClient>(CLIENT_TOKEN);
  private readonly snackBar = inject(MatSnackBar);

  readonly uploading = signal(false);
  readonly exporting = signal(false);
  readonly result = signal<MenuImportResult | null>(null);

  async exportCatalog(): Promise<void> {
    this.exporting.set(true);
    try {
      const file = await firstValueFrom(this.client.menuImport_Export());
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.saveFile(file, `menu-export-${stamp}.xlsx`);
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to export catalog'), 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.exporting.set(false);
    }
  }

  async downloadTemplate(): Promise<void> {
    try {
      const file = await firstValueFrom(this.client.menuImport_GetTemplate());
      this.saveFile(file, 'menu-template.xlsx');
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to download template'), 'Dismiss', {
        duration: 4000,
      });
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow selecting the same file again
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.snackBar.open('Please select an .xlsx file', 'Dismiss', { duration: 4000 });
      return;
    }

    this.uploading.set(true);
    this.result.set(null);

    try {
      const res = await firstValueFrom(
        this.client.menuImport_Import({ data: file, fileName: file.name }),
      );
      this.result.set(res);
      this.snackBar.open('Menu imported successfully', 'Dismiss', { duration: 3000 });
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Import failed'), 'Dismiss', { duration: 5000 });
    } finally {
      this.uploading.set(false);
    }
  }

  private saveFile(file: FileResponse, fallbackName: string): void {
    const url = URL.createObjectURL(file.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName ?? fallbackName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
