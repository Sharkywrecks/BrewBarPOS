import { Injectable, Inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CLIENT_TOKEN,
  IClient,
  RegisterShiftDto,
  OpenShiftDto,
  CloseShiftDto,
  CreateCashDropDto,
  ShiftStatus,
} from 'api-client';

export interface ShiftInfo {
  id: number;
  terminalId: number;
  cashierName: string | null;
  status: ShiftStatus;
  openingCashAmount: number;
  openedAtUtc: Date;
}

@Injectable({ providedIn: 'root' })
export class ShiftService {
  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  readonly currentShift = signal<ShiftInfo | null>(null);

  async openShift(terminalId: number, openingCashAmount: number): Promise<ShiftInfo> {
    const result = await firstValueFrom(
      this.client.shifts_OpenShift({ terminalId, openingCashAmount } as OpenShiftDto),
    );
    const shift = this.mapShiftInfo(result);
    this.currentShift.set(shift);
    return shift;
  }

  async closeShift(shiftId: number, closingCashAmount: number, notes?: string): Promise<void> {
    await firstValueFrom(
      this.client.shifts_CloseShift(shiftId, {
        closingCashAmount,
        closeNotes: notes,
      } as CloseShiftDto),
    );
    this.currentShift.set(null);
  }

  async addCashDrop(shiftId: number, amount: number, reason?: string): Promise<void> {
    await firstValueFrom(
      this.client.shifts_AddCashDrop(shiftId, { amount, reason } as CreateCashDropDto),
    );
  }

  async loadCurrentShift(terminalId: number): Promise<void> {
    try {
      const result = await firstValueFrom(this.client.shifts_GetCurrentShift(terminalId));
      this.currentShift.set(this.mapShiftInfo(result));
    } catch {
      this.currentShift.set(null);
    }
  }

  private mapShiftInfo(dto: RegisterShiftDto): ShiftInfo {
    return {
      id: dto.id!,
      terminalId: dto.terminalId!,
      cashierName: dto.cashierName ?? null,
      status: dto.status ?? ShiftStatus.Open,
      openingCashAmount: dto.openingCashAmount!,
      openedAtUtc: dto.openedAtUtc!,
    };
  }
}
