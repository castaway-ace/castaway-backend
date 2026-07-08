import { PartialType } from '@nestjs/swagger';
import { CreateWhitelistEntryDto } from './create-whitelist-entry.dto.js';

export class UpdateWhitelistEntryDto extends PartialType(
  CreateWhitelistEntryDto,
) {}
