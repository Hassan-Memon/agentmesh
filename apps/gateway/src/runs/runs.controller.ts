import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Run } from '@prisma/client';
import { RunEventDto } from '../events/run-event';
import { ApproveRunDto } from './dto/approve-run.dto';
import { StartRunDto } from './dto/start-run.dto';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  /** POST /runs : start a run. Returns 202 because the work continues after the response. */
  @Post()
  @HttpCode(202)
  start(@Body() dto: StartRunDto): Promise<Run> {
    return this.runs.start(dto);
  }

  /** GET /runs?limit=50 : newest first. */
  @Get()
  list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number): Promise<Run[]> {
    return this.runs.list(limit ?? 50);
  }

  /** GET /runs/:id */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Run> {
    return this.runs.get(id);
  }

  /** GET /runs/:id/events : persisted event log (Mongo or Postgres). */
  @Get(':id/events')
  events(@Param('id', ParseUUIDPipe) id: string): Promise<RunEventDto[]> {
    return this.runs.listEvents(id);
  }

  /** POST /runs/:id/approve : human-in-the-loop decision for a WAITING_APPROVAL run. */
  @Post(':id/approve')
  @HttpCode(202)
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveRunDto): Promise<Run> {
    return this.runs.approve(id, dto);
  }
}
