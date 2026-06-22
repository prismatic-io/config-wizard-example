import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Connection } from '@prismatic-io/spectral';
import { getGatewayUrl } from './config';

export type AcmeClientOptions = {
  connection: Connection;
  baseUrl?: string;
  debug?: boolean;
};

export class AcmeClient {
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly debug: boolean;

  constructor({ connection, baseUrl, debug = false }: AcmeClientOptions) {
    const apiKey = connection?.fields?.apiKey as string | undefined;
    if (!apiKey) {
      throw new Error(
        'Acme connection is missing or has no `apiKey`. The data source/action received an empty ' +
          '`params.connection` — ensure the component step is configured with an Acme API Key connection ' +
          'and that the data source input is bound to that connection.',
      );
    }
    this.apiKey = apiKey;
    this.debug = debug;
    this.http = axios.create({ baseURL: baseUrl ?? getGatewayUrl() });
  }

  public get<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.http
      .get<T>(path, this.withApiToken(config))
      .then((res) => res.data);
  }

  public post<T>(path: string, body?: unknown, config: AxiosRequestConfig = {}): Promise<T> {
    return this.http
      .post<T>(path, body, this.withApiToken(config))
      .then((res) => res.data);
  }

  /** Reserved for verbose request logging; accepted via constructor options. */
  public isDebug(): boolean {
    return this.debug;
  }

  private withApiToken(config: AxiosRequestConfig): AxiosRequestConfig {
    return {
      ...config,
      params: { ...(config.params ?? {}), apiToken: this.apiKey },
    };
  }
}
