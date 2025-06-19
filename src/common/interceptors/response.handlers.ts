import { HttpException, HttpStatus } from '@nestjs/common';

type TBadRequestParams = {
  errorCode: string;
  data?: any;
};

export function res500(error: { name: any; message: any }, payload: TBadRequestParams) {
  const { errorCode, data } = payload;
  throw new HttpException(
    {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: error.name,
      message: error.message || 'Internal Server Error',
      errorCode,
      data: data || null,
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

export function duplicateRecordRes(message: string, data?: any) {
  const response = {
    statusCode: HttpStatus.CONFLICT,
    error: 'Duplicate Entry',
    message,
    data: data || null,
  };

  throw new HttpException(response, HttpStatus.BAD_REQUEST);
}

export function badRequestRes(message: string, payload: TBadRequestParams) {
  const { errorCode, data } = payload;

  // Create the response object
  const response = {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    message,
    errorCode,
    data: data || null,
  };

  throw new HttpException(response, HttpStatus.BAD_REQUEST);
}

export function unAuthorizedRes(message?: string) {
  const response = {
    statusCode: HttpStatus.UNAUTHORIZED,
    error: 'Forbidden',
    message: message || 'Resource forbidden, access denied!',
    errorCode: 'resource_forbidden_access_denied',
  };

  throw new HttpException(response, HttpStatus.BAD_REQUEST);
}

export function successRes(data?: any, message?: string) {
  return {
    data,
    statusCode: HttpStatus.CREATED,
    message: message || 'Success',
    error: false,
  };
}
