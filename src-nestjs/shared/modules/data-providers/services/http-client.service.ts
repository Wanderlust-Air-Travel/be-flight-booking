import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

@Injectable()
export class HttpClientService {
  constructor(private readonly configService: ConfigService) {}

  async get<T>(url: string, options?: HttpClientOptions): Promise<T> {
    const { timeout = 10000, headers = {} } = options || {};
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${url}`);
    }

    return response.json() as Promise<T>;
  }

  async post<T>(url: string, body: unknown, options?: HttpClientOptions): Promise<T> {
    const { timeout = 10000, headers = {} } = options || {};
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${url}`);
    }

    return response.json() as Promise<T>;
  }

  getDefaultTimeout(): number {
    return this.configService.get<number>('httpClient.defaultTimeout', 10000) ?? 10000;
  }
}
