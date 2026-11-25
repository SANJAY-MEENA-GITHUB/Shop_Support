export interface ErrorDetail {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Access denied') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string) =>
  new ApiError(409, 'CONFLICT', message);

export const businessRule = (message: string, details?: ErrorDetail[]) =>
  new ApiError(422, 'BUSINESS_RULE', message, details);
