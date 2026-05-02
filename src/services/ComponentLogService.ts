import { getCustomRepository, Repository } from 'typeorm';
import { ComponentLogRepository } from '../repositories/ComponentLogRepository';
import { ComponentLog } from '../entities/ComponentLog';

export class ComponentLogService {
    private componentLogRepository: Repository<ComponentLog>;

    constructor() {
        this.componentLogRepository = getCustomRepository(
            ComponentLogRepository
        );
    }

    async getComponentLogs(componentId: string, options?: {
        type?: string;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    }) {
        const sortMap: Record<string, string> = {
            createdAt: 'component_logs.createdAt',
            type: 'component_logs.type',
            userName: 'user.name',
        };
        const sortBy = sortMap[options?.sortBy ?? ''] ?? 'component_logs.createdAt';
        const sortOrder = options?.sortOrder ?? 'DESC';

        const query = this.componentLogRepository
            .createQueryBuilder('component_logs')
            .leftJoinAndSelect('component_logs.user', 'user')
            .where([ { componentId } ])
            .orderBy(sortBy, sortOrder);

        if (options?.type) {
            query.andWhere('component_logs.type = :type', { type: options.type });
        }

        return query.getMany();
    }
}
