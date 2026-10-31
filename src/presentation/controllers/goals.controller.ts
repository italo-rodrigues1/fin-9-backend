import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../../infrastructure/auth';
import { GoalsService } from '../../application/goals.service';
import {
  GoalPageDto,
  SaveGoalContributionDto,
  SaveGoalDto,
} from '../dtos/goal.dto';
@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly service: GoalsService) {}
  @Get() overview(@CurrentUser() u: { id: string }) {
    return this.service.overview(u.id);
  }
  @Post() create(@CurrentUser() u: { id: string }, @Body() data: SaveGoalDto) {
    return this.service.saveGoal(u.id, data);
  }
  @Get(':id') detail(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query() page: GoalPageDto,
  ) {
    return this.service.detail(u.id, id, page);
  }
  @Patch(':id') update(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: SaveGoalDto,
  ) {
    return this.service.saveGoal(u.id, data, id);
  }
  @Delete(':id') remove(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteGoal(u.id, id);
  }
  @Post(':id/contributions') contribute(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: SaveGoalContributionDto,
  ) {
    return this.service.saveContribution(u.id, id, data);
  }
  @Get(':id/contributions/:contributionId') contribution(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
  ) {
    return this.service.getContribution(u.id, id, contributionId);
  }
  @Patch(':id/contributions/:contributionId') editContribution(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
    @Body() data: SaveGoalContributionDto,
  ) {
    return this.service.saveContribution(u.id, id, data, contributionId);
  }
  @Delete(':id/contributions/:contributionId') removeContribution(
    @CurrentUser() u: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
  ) {
    return this.service.deleteContribution(u.id, id, contributionId);
  }
}
