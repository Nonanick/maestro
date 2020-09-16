import { ApiError, ErrorDisplay} from './ApiError';

export abstract class ApiException extends Error {
  
  abstract get code() : string;

  constructor(...error: ErrorDisplay[]) {
    super(
      error
        .map((e) =>
          typeof e === "string" ? e : ApiError.stringfyApiErrorDescription(e)
        )
        .join("\n")
    );

  }
}