import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskFilterDto } from './dto/task-filter.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private readonly dataSource: DataSource,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const task = this.tasksRepository.create({
        ...createTaskDto,
        user: { id: createTaskDto.userId },
      });
      const savedTask = await this.tasksRepository.save(task);
      if (savedTask)
        this.taskQueue.add('task-status-update', {
          taskId: savedTask.id,
          status: savedTask.status,
        });

      await queryRunner.commitTransaction();
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async findAll(payload: TaskFilterDto): Promise<{ tasks: Task[]; count: number }> {
    const {
      page = 1,
      limit = 10,
      searchQuery,
      status,
      priority,
      userId,
      dateFrom,
      dateTo,
      sortingColumn,
      sortingOrder,
    } = payload;
    const skip = (page - 1) * limit;

    const queryBuilder = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user');

    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority });
    }

    if (userId) {
      queryBuilder.andWhere('task.userId = :userId', { userId });
    }
    if (searchQuery) {
      queryBuilder.andWhere(
        '(task.title LIKE :searchQuery OR task.description LIKE :searchQuery)',
        { searchQuery: `%${searchQuery}%` },
      );
    }
    if (dateFrom) {
      queryBuilder.andWhere('task.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      queryBuilder.andWhere('task.createdAt <= :dateTo', { dateTo });
    }

    const [tasks, count] = await queryBuilder
      .orderBy(sortingColumn ? `task.${sortingColumn}` : 'task.id', sortingOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { tasks, count };
  }

  async find(): Promise<Task[]> {
    return await this.tasksRepository.find();
  }

  async findOne(id: string): Promise<Task | null> {
    //handle the null case in controller
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task | null> {
    // Inefficient implementation: multiple database calls
    // and no transaction handling
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const task = await this.findOne(id);
      if (!task) {
        return null; // Handle this case in the controller
      }
      const updatedTask = Object.assign(task, updateTaskDto);
      const originalStatus = task.status;

      const updatedTaskSave = await this.tasksRepository.save(task);

      // Add to queue if status changed, but without proper error handling
      if (originalStatus !== updatedTaskSave.status) {
        this.taskQueue.add('task-status-update', {
          taskId: updatedTask.id,
          status: updatedTask.status,
        });
      }
      await queryRunner.commitTransaction();

      return updatedTaskSave;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.tasksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return { message: `Task with ID ${id} deleted successfully` };
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.tasksRepository.find({
      where: { status },
    });
  }

  async updateStatus(id: string, status: string): Promise<Task | null> {
    // This method will be called by the task processor
    const task = await this.findOne(id);
    if (!task) {
      return null;
    }
    task.status = status as any;
    return this.tasksRepository.save(task);
  }

  async batchProcessTasks(taskIds: string[], action: 'complete' | 'delete') {
    if (action === 'complete') {
      const updated = await this.tasksRepository
        .createQueryBuilder()
        .update(Task)
        .set({ status: TaskStatus.COMPLETED })
        .whereInIds(taskIds)
        .andWhere('status != :status', { status: TaskStatus.COMPLETED }) // avoid unnecessary writes
        .execute();

      // Enqueue status update events
      for (const taskId of taskIds) {
        await this.taskQueue.add('task-status-update', {
          taskId,
          status: TaskStatus.COMPLETED,
        });
      }

      return { updated: updated.affected };
    }

    if (action === 'delete') {
      const deleted = await this.tasksRepository
        .createQueryBuilder()
        .delete()
        .from(Task)
        .whereInIds(taskIds)
        .execute();

      return { deleted: deleted.affected };
    }

    throw new Error('Invalid action');
  }
}
