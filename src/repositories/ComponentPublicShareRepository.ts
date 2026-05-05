import { EntityRepository, Repository } from 'typeorm';

import { ComponentPublicShare } from '../entities/ComponentPublicShare';

@EntityRepository(ComponentPublicShare)
class ComponentPublicShareRepository extends Repository<ComponentPublicShare> {}

export { ComponentPublicShareRepository };
