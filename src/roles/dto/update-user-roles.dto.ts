import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { Role } from '../../generated/prisma/client.js';

export class UpdateUserRolesDto {
  @ApiProperty({
    enum: Role,
    isArray: true,
    description: 'The complete set of roles the user should have.',
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}
