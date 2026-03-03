// TypeScript: Generic Repository pattern with TypeORM
// Paradigm: OOP, generics, repository/data-access pattern, dependency injection
import {
  DataSource,
  Repository,
  FindManyOptions,
  FindOneOptions,
  DeepPartial,
  ObjectLiteral,
} from 'typeorm';

export interface IRepository<T extends ObjectLiteral, ID> {
  findById(id: ID): Promise<T | null>;
  findAll(options?: FindManyOptions<T>): Promise<T[]>;
  findOne(options: FindOneOptions<T>): Promise<T | null>;
  save(entity: DeepPartial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
  count(options?: FindManyOptions<T>): Promise<number>;
}

export class GenericRepository<T extends ObjectLiteral, ID = string>
  implements IRepository<T, ID>
{
  protected readonly repo: Repository<T>;

  constructor(entity: new () => T, dataSource: DataSource) {
    this.repo = dataSource.getRepository(entity);
  }

  async findById(id: ID): Promise<T | null> {
    return this.repo.findOne({ where: { id } as any });
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(options);
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne(options);
  }

  async save(entity: DeepPartial<T>): Promise<T> {
    return this.repo.save(entity);
  }

  async delete(id: ID): Promise<void> {
    await this.repo.delete(id as any);
  }

  async count(options?: FindManyOptions<T>): Promise<number> {
    return this.repo.count(options);
  }
}

export class UserRepository extends GenericRepository<User, string> {
  constructor(dataSource: DataSource) {
    super(User, dataSource);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
      relations: ['profile', 'roles'],
    });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.repo.find({ where: { isActive: true } });
  }
}

// Minimal entity for type-checking
declare class User {
  id: string;
  email: string;
  isActive: boolean;
}
