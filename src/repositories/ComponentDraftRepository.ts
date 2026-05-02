import { EntityRepository, Repository } from 'typeorm';
import { ComponentDraft } from '../entities/ComponentDraft';

@EntityRepository(ComponentDraft)
class ComponentDraftRepository extends Repository<ComponentDraft> { }

export { ComponentDraftRepository };