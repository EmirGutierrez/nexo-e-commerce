/** Contrato central para sustituir los mocks por fetch/axios cuando exista la API. */
export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export const mockApiClient: ApiClient = {
  async get<T>(_path: string) { return undefined as T; },
  async post<T>(_path: string, _body: unknown) { return undefined as T; },
  async put<T>(_path: string, _body: unknown) { return undefined as T; },
  async delete<T>(_path: string) { return undefined as T; },
};
