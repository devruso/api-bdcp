import { EntityRepository, Repository } from 'typeorm';

import { ComponentRelation } from '../entities/ComponentRelation';

@EntityRepository(ComponentRelation)
class ComponentRelationRepository extends Repository<ComponentRelation> { }

export { ComponentRelationRepository };
