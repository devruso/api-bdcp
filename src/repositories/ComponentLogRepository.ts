import { EntityRepository, Repository } from 'typeorm';
import { ComponentLog } from '../entities/ComponentLog';

@EntityRepository(ComponentLog)
class ComponentLogRepository extends Repository<ComponentLog> { }

export { ComponentLogRepository };
