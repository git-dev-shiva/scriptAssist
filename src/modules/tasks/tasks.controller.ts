import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaskStatus } from './enums/task-status.enum';
import { TaskPriority } from './enums/task-priority.enum';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { TaskFilterDto } from './dto/task-filter.dto';
import { badRequestRes, res500, successRes } from '@common/interceptors/response.handlers';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';

// This guard needs to be implemented or imported from the correct location
// We're intentionally leaving it as a non-working placeholder

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.tasksService.create(createTaskDto);
    if (!task) {
      return badRequestRes('Failed to create task', {
        errorCode: 'task_creation_failed',
      });
    }
    return successRes(task);
  }

  @Get()
  @ApiOperation({ summary: 'Find all tasks with optional filtering' })
  async findAll(@Query() query: TaskFilterDto) {
    let { tasks, count } = await this.tasksService.findAll(query);

    return successRes({ tasks, count });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  async getStats() {
    // Inefficient approach: N+1 query problem
    // const tasks = await this.taskRepository.find();
    const tasks = await this.tasksService.find();

    // Inefficient computation: Should be done with SQL aggregation
    const statistics = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      highPriority: tasks.filter(t => t.priority === TaskPriority.HIGH).length,
    };

    return successRes(statistics);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a task by ID' })
  async findOne(@Param('id') id: string) {
    const task = await this.tasksService.findOne(id);

    if (!task) {
      return badRequestRes('Task not found', {
        errorCode: 'task_not_found',
      });
    }

    return successRes(task);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    // No validation if task exists before update
    const updatedTask = await this.tasksService.update(id, updateTaskDto);
    if (!updatedTask) {
      return badRequestRes('Failed to update task', {
        errorCode: 'task_update_failed',
      });
    }
    return successRes(updatedTask);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(@Param('id') id: string) {
    return await this.tasksService.remove(id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch process multiple tasks' })
  async batchProcess(@Body() operations: { tasks: string[]; action: string }) {
    // Inefficient batch processing: Sequential processing instead of bulk operations
    const { tasks: taskIds, action } = operations;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return badRequestRes('No task IDs provided', {
        errorCode: 'no_task_ids_provided',
      });
    }
    const results = [];

    // N+1 query problem: Processing tasks one by one
    for (const taskId of taskIds) {
      try {
        let result;

        switch (action) {
          case 'complete':
            result = await this.tasksService.update(taskId, { status: TaskStatus.COMPLETED });
            break;
          case 'delete':
            result = await this.tasksService.remove(taskId);
            break;
          default:
            return res500(
              { name: 'InvalidActionError', message: 'Invalid action provided' },
              { errorCode: 'invalid_action', data: { action } },
            );
        }

        results.push({ taskId, success: true, result });
      } catch (error: any) {
        // Inconsistent error handling
        results.push({
          taskId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}
