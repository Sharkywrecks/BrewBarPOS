import { type Page, type Locator } from '@playwright/test';

export class AdminCatalogPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly categoriesTab: Locator;
  readonly productsTab: Locator;
  readonly modifiersTab: Locator;
  readonly categoryTable: Locator;
  readonly categoryRows: Locator;
  readonly productTable: Locator;
  readonly productRows: Locator;
  readonly modifierTable: Locator;
  readonly modifierRows: Locator;
  readonly spinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1', { hasText: 'Catalog' });
    this.categoriesTab = page.getByRole('tab', { name: 'Categories' });
    this.productsTab = page.getByRole('tab', { name: 'Products' });
    this.modifiersTab = page.getByRole('tab', { name: 'Modifiers' });
    this.categoryTable = page.locator('.catalog-table').first();
    this.categoryRows = page.locator('tr.mat-mdc-row');
    this.productTable = page.locator('.catalog-table');
    this.productRows = page.locator('tr.mat-mdc-row');
    this.modifierTable = page.locator('.catalog-table');
    this.modifierRows = page.locator('tr.mat-mdc-row');
    this.spinner = page.locator('mat-spinner');
  }

  async goto() {
    await this.page.route('**/config.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ apiUrl: 'http://localhost:5050' }),
      }),
    );
    await this.page.goto('/catalog', { timeout: 60_000 });
  }

  async clickNewCategory() {
    await this.page.locator('button', { hasText: 'New Category' }).click();
  }

  async clickNewProduct() {
    await this.page.locator('button', { hasText: 'New Product' }).click();
  }

  async clickNewModifier() {
    await this.page.locator('button', { hasText: 'New Modifier' }).click();
  }

  async editRowByName(name: string) {
    const row = this.page.locator('tr.mat-mdc-row', { hasText: name });
    await row
      .locator('button', { has: this.page.locator('mat-icon', { hasText: 'edit' }) })
      .click();
  }

  async deleteRowByName(name: string) {
    // Accept the browser confirm dialog that will appear
    this.page.once('dialog', (dialog) => dialog.accept());

    const row = this.page.locator('tr.mat-mdc-row', { hasText: name });
    await row
      .locator('button[color="warn"]', {
        has: this.page.locator('mat-icon', { hasText: 'delete' }),
      })
      .click();
  }
}
