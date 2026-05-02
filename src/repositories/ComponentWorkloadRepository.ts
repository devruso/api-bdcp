import { EntityRepository, Repository } from 'typeorm';
import { ComponentWorkload } from '../entities/ComponentWorkload';

@EntityRepository(ComponentWorkload)
class ComponentWorkloadRepository extends Repository<ComponentWorkload> { }

export { ComponentWorkloadRepository };
