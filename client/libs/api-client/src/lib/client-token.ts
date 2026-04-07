import { InjectionToken } from '@angular/core';
import { IClient } from './generated/client.api';

export const CLIENT_TOKEN = new InjectionToken<IClient>('CLIENT_TOKEN');
