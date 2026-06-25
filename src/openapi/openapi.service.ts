import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';

@Injectable()
export class OpenApiService {
  private document: OpenAPIObject | null = null;

  setDocument(document: OpenAPIObject): void {
    this.document = document;
  }

  getDocument(): OpenAPIObject {
    if (this.document === null) {
      throw new ServiceUnavailableException('OpenAPI document not available');
    }
    return this.document;
  }
}
