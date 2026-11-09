import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveRunDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  feedback?: string;

  /** Extra structured values handed to the graph on resume (edited draft, selections). */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
