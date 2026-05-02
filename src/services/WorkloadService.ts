import { getCustomRepository, Repository } from 'typeorm';
import { ComponentWorkloadRepository } from '../repositories/ComponentWorkloadRepository';
import { AppError } from '../errors/AppError';
import { ComponentWorkload } from '../entities/ComponentWorkload';

export class WorkloadService {

    private workloadRepository : Repository<ComponentWorkload>;

    constructor() {
        this.workloadRepository = getCustomRepository(ComponentWorkloadRepository);
    }

    async getWorkloadById(id: string) {
        const workload = await this.workloadRepository.findOne({
            where: { id },
        });

        if (!workload) return null;
        return workload;
    }

    async create(
        dto: Omit<ComponentWorkload, 'id'>
    ) {
        try {
            const workload = this.workloadRepository.create({ ...dto });

            return await this.workloadRepository.save(workload);
        }
        catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async update(
        id: number,
        dto: Partial<ComponentWorkload>
    ) {
        const workloadExists = await this.workloadRepository.findOne({
            where: { id }
        });

        if(!workloadExists){
            throw new AppError('Workload not found.', 404);
        }

        try {
            await this.workloadRepository.createQueryBuilder().update(ComponentWorkload)
                .set(dto)
                .where('id = :id', { id })
                .execute();

            return await this.workloadRepository.findOne({
                where: { id }
            });
        }
        catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async upsert(
        dto: ComponentWorkload
    ) {
        const workloadExists = dto?.id == null
            ? null
            :  await this.workloadRepository.findOne({
                where: { id: dto.id }
            });
        if(!workloadExists) {
            return this.create(dto);
        }

        await this.workloadRepository.save({ ...workloadExists, ...dto });

        return this.workloadRepository.findOne({
            where: { id: dto.id }
        });
    }

    async delete(id: string){
        const workloadExists = await this.workloadRepository.findOne({
            where: { id }
        });

        if(!workloadExists){
            throw new AppError('Workload not found.', 404);
        }

        return this.workloadRepository.delete(workloadExists.id);
    }

}
