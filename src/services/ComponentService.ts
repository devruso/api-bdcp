import { Brackets, getCustomRepository, Raw, Repository } from 'typeorm';
import puppeteer from 'puppeteer';
import { generateHtml } from '../helpers/templates/component';
import { Component } from '../entities/Component';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { AppError } from '../errors/AppError';
import { WorkloadService } from './WorkloadService';
import { ComponentLog } from '../entities/ComponentLog';
import { ComponentLogRepository } from '../repositories/ComponentLogRepository';
import { ComponentLogType } from '../interfaces/ComponentLogType';
import { ComponentStatus } from '../interfaces/ComponentStatus';
import {
    CreateComponentRequestDto,
    UpdateComponentRequestDto,
} from '../dtos/component';
import { ComponentDraft } from '../entities/ComponentDraft';
import { ComponentDraftRepository } from '../repositories/ComponentDraftRepository';

export class ComponentService {
    private componentRepository: Repository<Component>;
    private componentLogRepository: Repository<ComponentLog>;
    private componentDraftRepository: Repository<ComponentDraft>;
    private workloadService: WorkloadService;

    constructor() {
        this.componentRepository = getCustomRepository(ComponentRepository);
        this.componentLogRepository = getCustomRepository(
            ComponentLogRepository
        );
        this.componentDraftRepository = getCustomRepository(
            ComponentDraftRepository
        );
        this.workloadService = new WorkloadService();
    }

    async getComponents(options?: {
        search?: string;
        showDraft?: boolean;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    }) {
        const search = options?.search?.trim().toLowerCase();
        const sortMap: Record<string, string> = {
            code: 'components.code',
            name: 'components.name',
            department: 'components.department',
            semester: 'components.semester',
            createdAt: 'components.createdAt',
            updatedAt: 'components.updatedAt',
        };
        const sortBy = sortMap[options?.sortBy ?? ''] ?? 'components.code';
        const sortOrder = options?.sortOrder ?? 'ASC';
        const allowedStatuses = [ ComponentStatus.PUBLISHED ];

        if (options?.showDraft) {
            allowedStatuses.push(ComponentStatus.DRAFT);
        }

        const query = this.componentRepository
            .createQueryBuilder('components')
            .leftJoinAndSelect('components.draft', 'draft')
            .leftJoinAndSelect('components.logs', 'logs')
            .leftJoinAndSelect('components.workload', 'workload')
            .leftJoinAndSelect('draft.workload', 'draft_workload')
            .leftJoinAndSelect('logs.user', 'logs_user')
            .where('components.status IN (:...allowedStatuses)', { allowedStatuses });

        if (search) {
            query.andWhere(new Brackets((subQuery) => {
                subQuery
                    .where('LOWER(components.code) LIKE :search', { search: `%${search}%` })
                    .orWhere('LOWER(components.name) LIKE :search', { search: `%${search}%` });
            }));
        }

        const components = await query
            .orderBy(sortBy, sortOrder)
            .addOrderBy('logs.createdAt', 'DESC')
            .getMany();

        return components;
    }

    async getComponentByCode(code: string) {
        const component = await this.componentRepository
            .createQueryBuilder('components')
            .leftJoinAndSelect('components.draft', 'draft')
            .leftJoinAndSelect('components.logs', 'logs')
            .leftJoinAndSelect('components.workload', 'workload')
            .leftJoinAndSelect('draft.workload', 'draft_workload')
            .leftJoinAndSelect('logs.user', 'logs_user')
            .where({
                code: Raw((alias) => `LOWER(${alias}) LIKE :code`, {
                    code: `%${code.toLowerCase()}%`,
                }),
            })
            .orderBy({
                'logs.createdAt': 'DESC',
            })
            .getOne();

        if (!component) throw new AppError('Component not found.', 404);

        return component;
    }

    async create(userId: string, requestDto: CreateComponentRequestDto) {
        const componentExists = await this.componentRepository.findOne({
            where: { code: requestDto.code },
        });

        if (componentExists) {
            throw new AppError('Component already exists.', 400);
        }

        try {
            const componentDto = { ...requestDto, userId: userId };

            const [ componentWorkload, draftWorkload ] = await Promise.all(
                new Array(2)
                    .fill(null)
                    .map(() =>
                        this.workloadService.create(componentDto.workload ?? {})
                    )
            );

            delete componentDto.workload;
            componentDto.workloadId = componentWorkload.id;

            const component = this.componentRepository.create({
                status: ComponentStatus.PUBLISHED,
                ...componentDto,
            });
            const createdComponent = await this.componentRepository.save(
                component
            );

            const draft = this.componentDraftRepository.create({
                ...component,
                id: undefined,
                workloadId: draftWorkload.id,
                status: undefined,
                componentId: component.id,
            } as unknown as ComponentDraft);

            let componentLog = component.generateLog(
                userId,
                ComponentLogType.CREATION
            );
            componentLog = this.componentLogRepository.create(componentLog);

            await Promise.all([
                this.componentLogRepository.save(componentLog),
                this.componentDraftRepository.save(draft),
            ]);

            await this.componentRepository.save({
                id: component.id,
                draftId: draft.id,
            });
            component.draftId = draft.id;

            return createdComponent;
        } catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async update(
        id: string,
        componentDto: UpdateComponentRequestDto,
        userId: string
    ) {
        const componentExists = await this.componentRepository.findOne({
            where: { id },
        });

        if (!componentExists) {
            throw new AppError('Component not found.', 404);
        }

        const codeComponent =
            componentDto?.code !== componentExists.code
                ? await this.componentRepository.findOne({
                    where: { code: componentDto.code },
                })
                : null;
        if (codeComponent) {
            throw new AppError('Invalid code', 400);
        }

        try {
            if (componentDto.workload != null) {
                const workloadData = {
                    ...componentDto.workload,
                    id:
                        componentDto.workloadId ??
                        (componentExists.workloadId as string),
                };

                const workload = await this.workloadService.upsert(
                    workloadData
                );
                componentDto.workloadId = workload?.id;
                delete componentDto.workload;
            }

            await this.componentRepository
                .createQueryBuilder()
                .update(Component)
                .set(componentDto)
                .where('id = :id', { id })
                .execute();

            let componentLog = componentExists.generateLog(
                userId,
                ComponentLogType.UPDATE
            );
            componentLog = this.componentLogRepository.create(componentLog);
            await this.componentLogRepository.save(componentLog);

            return await this.componentRepository.findOne({
                where: { id },
            });
        } catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async delete(id: string) {
        const [ componentExists, draft ] = await Promise.all([
            this.componentRepository.findOne({
                where: { id },
            }),
            this.componentDraftRepository.findOne({
                componentId: id,
            }),
        ]);

        if (!componentExists) {
            throw new AppError('Component not found.', 404);
        }

        await this.componentRepository.save({
            ...componentExists,
            draftId: null,
        });

        await Promise.all([
            this.componentLogRepository.delete({
                componentId: id,
            }),
            !draft
                ? null
                : this.componentDraftRepository.delete({
                    id: draft.id,
                }),
        ]);
        await this.componentRepository
            .createQueryBuilder()
            .delete()
            .from(Component)
            .where('id = :id', { id })
            .execute();

        if (componentExists.workloadId != null) {
            await Promise.all([
                this.workloadService.delete(componentExists.workloadId),
                this.workloadService.delete(draft?.workloadId as string),
            ]);
        }
    }

    async export(id: string) {
        const component = await this.componentRepository
            .createQueryBuilder('components')
            .leftJoinAndSelect('components.workload', 'workload')
            .leftJoinAndSelect('components.logs', 'logs')
            .where({ id })
            .getOne();

        if (!component) {
            throw new AppError('Component not found.', 404);
        }

        const { workload, logs } = component;
        const latestApprovalLog = logs
            ?.filter((log) => log.type === ComponentLogType.APPROVAL)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

        const data = {
            ...component,
            approval: latestApprovalLog
                ? {
                    agreementNumber: latestApprovalLog.agreementNumber,
                    agreementDate: latestApprovalLog.agreementDate,
                }
                : undefined,
            workload: workload
                ? {
                    student: {
                        theory: workload.studentTheory,
                        practice: workload.studentPractice,
                        theoryPractice: workload.studentTheoryPractice,
                        internship: workload.studentInternship,
                        practiceInternship:
                              workload.studentPracticeInternship,
                    },
                    professor: {
                        theory: workload.teacherTheory,
                        practice: workload.teacherPractice,
                        theoryPractice: workload.teacherTheoryPractice,
                        internship: workload.teacherInternship,
                        practiceInternship:
                              workload.teacherPracticeInternship,
                    },
                    module: {
                        theory: workload.moduleTheory,
                        practice: workload.modulePractice,
                        theoryPractice: workload.moduleTheoryPractice,
                        internship: workload.moduleInternship,
                        practiceInternship: workload.modulePracticeInternship,
                    },
                }
                : undefined,
        };

        const html = generateHtml(data);

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });
        const page = await browser.newPage();
        await page.setViewport({
            width: 1560,
            height: 1920,
        });
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        const pdf = await page.pdf({
            printBackground: true,
        });

        await browser.close();

        return pdf;
    }
}
