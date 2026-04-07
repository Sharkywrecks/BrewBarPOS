import { Injectable, Inject, signal } from '@angular/core';
import { CLIENT_TOKEN, IClient, CategoryDto, CategoryDetailDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly categories = signal<CategoryDto[]>([]);
  readonly selectedCategory = signal<CategoryDetailDto | null>(null);
  readonly loading = signal(false);

  private categoryCache = new Map<number, CategoryDetailDto>();

  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  async loadCategories(): Promise<void> {
    this.loading.set(true);
    try {
      const cats = await firstValueFrom(this.client.categories_GetCategories(true));
      this.categories.set(cats);

      if (cats.length > 0 && !this.selectedCategory()) {
        await this.selectCategory(cats[0].id!);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async selectCategory(id: number): Promise<void> {
    const cached = this.categoryCache.get(id);
    if (cached) {
      this.selectedCategory.set(cached);
      return;
    }

    this.loading.set(true);
    try {
      const detail = await firstValueFrom(this.client.categories_GetCategory(id));
      this.categoryCache.set(id, detail);
      this.selectedCategory.set(detail);
    } finally {
      this.loading.set(false);
    }
  }

  clearCache(): void {
    this.categoryCache.clear();
  }
}
