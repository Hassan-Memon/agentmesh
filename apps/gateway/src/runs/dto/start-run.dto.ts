// DTO = the validated shape of a request body. class-validator decorators run inside the
// global ValidationPipe (main.ts) before the controller method is called.
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class StartRunDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,63}$/, { message: 'agent must be a registry name such as "researcher"' })
  agent!: string;

  @IsString()
  @Length(1, 20_000)
  input!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
