export interface IResponse<T> {
  data: T;
}

export interface IResponseObj<T> {
  data: T;
  statusCode: number;
  message: string;
  totalCount: number;
  moduleNames: string[];
  lastSyncTime: Date;
  step: number;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
