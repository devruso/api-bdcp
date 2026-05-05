import { Brackets, getCustomRepository, Repository, getConnection, Raw } from 'typeorm';
import crypto from 'crypto';
import { ComponentDraftRepository } from '../repositories/ComponentDraftRepository';
import { AppError } from '../errors/AppError';
import { WorkloadService } from './WorkloadService';
import { ComponentDraft } from '../entities/ComponentDraft';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { Component } from '../entities/Component';
import { ComponentLog } from '../entities/ComponentLog';
import { ComponentStatus } from '../interfaces/ComponentStatus';
import { ComponentWorkload } from '../entities/ComponentWorkload';
import { ComponentLogType } from '../interfaces/ComponentLogType';
import { ApproveDraftRequestDto } from '../dtos/component/draft/ApproveDraftRequest';
import { CreateDraftRequestDto } from '../dtos/component/draft/CreateDraftRequest';
import { UpdateComponentRequestDto } from '../dtos/component';
import { ComponentLogRepository } from '../repositories/ComponentLogRepository';
import { User } from '../entities/User';
import { UserRepository } from '../repositories/UserRepository';

export class ComponentDraftService {

    private componentDraftRepository : Repository<ComponentDraft>;
    private componentRepository: Repository<Component>;
    private componentLogRepository: Repository<ComponentLog>;
    private userRepository: Repository<User>;
    private workloadService: WorkloadService;

    constructor() {
        this.componentDraftRepository = getCustomRepository(ComponentDraftRepository);
        this.componentRepository = getCustomRepository(ComponentRepository);
        this.componentLogRepository = getCustomRepository(ComponentLogRepository);
        this.userRepository = getCustomRepository(UserRepository);
        this.workloadService = new WorkloadService();
    }

    private buildApprovalVersionCode(agreementDate: Date | string, agreementNumber: string) {
        const referenceDate = new Date(agreementDate);

        if (Number.isNaN(referenceDate.getTime())) {
            return agreementNumber;
        }

        const day = String(referenceDate.getUTCDate()).padStart(2, '0');
        const month = String(referenceDate.getUTCMonth() + 1).padStart(2, '0');
        const year = String(referenceDate.getUTCFullYear());

        return `${day}${month}${year}${agreementNumber}`;
    }

    private extractPrerequerimentCodes(value?: string) {
        if (!value) {
            return [];
        }

        return Array.from(new Set(value.toUpperCase().match(/\b[A-Z]{2,4}[0-9]{2,4}\b/g) ?? []));
    }

    private async normalizeAndValidatePrerequeriments(
        value: string | undefined,
        currentCode?: string
    ) {
        const rawValue = (value ?? '').trim();

        if (!rawValue || /^(n[aã]o\s+se\s+aplica|nenhum(a)?|n\/a|NAO_SE_APLICA)$/i.test(rawValue)) {
            return '';
        }

        const codes = this.extractPrerequerimentCodes(rawValue);

        if (codes.length === 0) {
            return rawValue;
        }

        const normalizedCurrentCode = currentCode?.toUpperCase();

        if (normalizedCurrentCode && codes.includes(normalizedCurrentCode)) {
            throw new AppError('Uma disciplina não pode ter a si mesma como pré-requisito.', 400);
        }

        return codes.join(', ');
    }

    private buildDraftUpdateDescription(
        draft: ComponentDraft,
        requestDto: UpdateComponentRequestDto,
        workloadPatch?: UpdateComponentRequestDto['workload']
    ) {
        const changedFields: string[] = [];
        const criticalChanges: string[] = [];

        const scalarFields: Array<keyof UpdateComponentRequestDto> = [
            'code',
            'name',
            'department',
            'semester',
            'modality',
            'program',
            'objective',
            'syllabus',
            'methodology',
            'learningAssessment',
            'bibliography',
            'prerequeriments',
        ];

        scalarFields.forEach((field) => {
            const nextValue = requestDto[field];

            if (nextValue === undefined) {
                return;
            }

            const previousValue = draft[field as keyof ComponentDraft];

            if (previousValue !== nextValue) {
                changedFields.push(String(field));

                if (field === 'program') {
                    criticalChanges.push(`program: "${String(previousValue ?? '')}" -> "${String(nextValue)}"`);
                }
            }
        });

        if (workloadPatch) {
            const currentWorkload = draft.workload ?? {};

            Object.entries(workloadPatch).forEach(([key, nextValue]) => {
                if (nextValue === undefined) {
                    return;
                }

                const previousValue = (currentWorkload as Record<string, unknown>)[key];

                if (previousValue !== nextValue) {
                    changedFields.push(`workload.${key}`);
                    criticalChanges.push(`workload.${key}: ${String(previousValue ?? 0)} -> ${String(nextValue)}`);
                }
            });
        }

        if (changedFields.length === 0) {
            return 'Rascunho alterado';
        }

        if (criticalChanges.length === 0) {
            return `Rascunho alterado: ${changedFields.join(', ')}`;
        }

        return `Rascunho alterado: ${changedFields.join(', ')} | detalhes: ${criticalChanges.join('; ')}`;
    }

    async getDrafts(options?: {
        search?: string;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    }) {
        const search = options?.search?.trim().toLowerCase();
        const sortMap: Record<string, string> = {
            code: 'drafts.code',
            name: 'drafts.name',
            department: 'drafts.department',
            semester: 'drafts.semester',
            createdAt: 'drafts.createdAt',
            updatedAt: 'drafts.updatedAt',
        };
        const sortBy = sortMap[options?.sortBy ?? ''] ?? 'drafts.updatedAt';
        const sortOrder = options?.sortOrder ?? 'DESC';

        const query = this.componentDraftRepository
            .createQueryBuilder('drafts')
            .leftJoinAndSelect('drafts.workload', 'workload');

        if (search) {
            query.where(new Brackets((subQuery) => {
                subQuery
                    .where('LOWER(drafts.code) LIKE :search', { search: `%${search}%` })
                    .orWhere('LOWER(drafts.name) LIKE :search', { search: `%${search}%` });
            }));
        }

        const drafts = await query.orderBy(sortBy, sortOrder).getMany();

        return drafts;
    }

    async getDraftByCode(code: string) {
        const normalizedCode = code.trim().toLowerCase();

        const draft = await this.componentDraftRepository.findOne({
            where: {
                code: Raw((alias) => `LOWER(${alias}) = :code`, { code: normalizedCode })
            },
            relations: [ 'workload', 'logs' ],
        });

        if (!draft) return null;

        return draft;
    }

    async create(
        userId: string,
        requestDto: CreateDraftRequestDto
    ){
        const normalizedCode = requestDto.code.trim().toUpperCase();
        const draftExists = await this.componentDraftRepository.findOne({
            where: { code: normalizedCode },
        });

        if (draftExists) {
            throw new AppError('Draft already exists.', 400);
        }

        try {
            const draftDto = {
                ...requestDto,
                code: normalizedCode,
                prerequeriments: await this.normalizeAndValidatePrerequeriments(
                    requestDto.prerequeriments,
                    normalizedCode
                ),
                userId: userId,
            };

            const [ draftWorkload, componentWorkload ] = await Promise.all([
                this.workloadService.create(draftDto.workload ?? {}),
                this.workloadService.create(draftDto.workload ?? {})
            ]);
            draftDto.workloadId = draftWorkload.id;

            delete draftDto.workload;

            const component = this.componentRepository.create({
                ...draftDto,
                status: ComponentStatus.DRAFT,
                workloadId: componentWorkload.id
            });
            await this.componentRepository.save(component);
            let componentLog = component.generateLog(userId, ComponentLogType.CREATION);
            componentLog = this.componentLogRepository.create(componentLog);

            const draft = this.componentDraftRepository.create({ ...draftDto, componentId: component.id });
            await Promise.all([
                this.componentDraftRepository.save(draft),
                this.componentLogRepository.save(componentLog),
            ]);

            await this.componentRepository.save({ ...component, draftId: draft.id });

            return draft;
        }
        catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async update(
        draftId: string,
        userId: string,
        requestDto: UpdateComponentRequestDto,
    ) {
        const connection = getConnection();
        const queryRunner = connection.createQueryRunner();
        const draftExists = await this.componentDraftRepository.findOne({
            where: { id: draftId },
            relations: [ 'workload' ],
        });
        if(!draftExists){
            throw new AppError('Draft not found.', 404);
        }

        const nextCode = requestDto.code?.trim().toUpperCase();
        const codeDraft = nextCode && nextCode !== draftExists.code
            ? await this.componentDraftRepository.findOne({ where: { code: nextCode } })
            : null;
        if(codeDraft) {
            throw new AppError('Invalid code', 400);
        }

        try {
            const workloadPatch = requestDto.workload == null
                ? undefined
                : { ...requestDto.workload };

            if (nextCode) {
                requestDto.code = nextCode;
            }

            if (requestDto.prerequeriments !== undefined) {
                requestDto.prerequeriments = await this.normalizeAndValidatePrerequeriments(
                    requestDto.prerequeriments,
                    nextCode ?? draftExists.code
                );
            }

            if(requestDto.workload != null) {
                const workloadData = {
                    ...workloadPatch,
                    id: requestDto.workloadId ?? draftExists.workloadId as string,
                };
                const workload = await this.workloadService.upsert(workloadData);
                requestDto.workloadId = workload?.id;
                delete requestDto.workload;
            }

            await queryRunner.startTransaction();

            const [ updatedDraft ] = await Promise.all([
                queryRunner.manager.save(
                    ComponentDraft,
                    {
                        ...draftExists,
                        ...requestDto
                    }
                ),
                queryRunner.manager.save(
                    ComponentLog,
                    {
                        ...draftExists.generateDraftLog(
                            ComponentLogType.DRAFT_UPDATE,
                            userId
                        ),
                        description: this.buildDraftUpdateDescription(
                            draftExists,
                            requestDto,
                            workloadPatch
                        ),
                    }
                ),
            ]); 

            await queryRunner.commitTransaction();

            return updatedDraft;
        }
        catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async delete(id: string){
        const componentExists = await this.componentDraftRepository.findOne({
            where: { id }
        });

        if(!componentExists){
            throw new AppError('Draft not found.', 404);
        }

        await this.componentDraftRepository.delete(id);
            
        if (componentExists.workloadId != null)
            await this.workloadService.delete(componentExists.workloadId);
    }

    async approve(
        draftId: string,
        approvalDto: ApproveDraftRequestDto,
        userId: string
    ) {
        try {
            const connection = getConnection();
            const queryRunner = connection.createQueryRunner();
            const approver = await this.userRepository.findOne({ where: { id: userId, isDeleted: false } });

            if (!approver) {
                throw new AppError('User not found.', 404);
            }

            if (!approver.signatureHash) {
                throw new AppError('Assinatura digital não configurada. Atualize sua assinatura no perfil antes de publicar.', 400);
            }

            const informedSignatureHash = crypto
                .createHmac('sha256', approvalDto.signature.trim())
                .digest('hex');

            if (informedSignatureHash !== approver.signatureHash) {
                throw new AppError('Assinatura inválida para publicação oficial.', 401);
            }

            const draftExists = await this.componentDraftRepository.findOne({
                where: { id: draftId }
            });

            if(!draftExists){
                throw new AppError('Draft not found.', 404);
            }

            const [ currentPublishedComponent, draftWorkload ] = await Promise.all([
                this.componentRepository.findOne({
                    where: { id: draftExists.componentId },
                }),
                this.workloadService.getWorkloadById(draftExists.workloadId as string)
            ]) as [ Component, ComponentWorkload ];

            const component = currentPublishedComponent.publishDraft(draftExists);
            const versionCode = this.buildApprovalVersionCode(
                approvalDto.agreementDate,
                approvalDto.agreementNumber
            );

            const approvalLog = component.generateLog(
                userId,
                ComponentLogType.APPROVAL,
                `Versao oficial ${versionCode} publicada por aprovacao formal com assinatura validada.`,
                approvalDto.agreementNumber,
                approvalDto.agreementDate,
                versionCode,
                component.program,
                component.syllabus,
            );

            await queryRunner.startTransaction();

            const [ updatedComponent ] = await Promise.all([
                queryRunner.manager.save(Component, component),
                queryRunner.manager.save(ComponentLog, approvalLog),
                queryRunner.manager.save(ComponentWorkload, { ...draftWorkload, id: currentPublishedComponent.workloadId }),
                queryRunner.manager.update(
                    ComponentLog,
                    { draftId } as Partial<ComponentLog>,
                    { draftId: null, componentId: currentPublishedComponent.id }
                )
            ]); 

            await queryRunner.commitTransaction();

            return updatedComponent;
        } catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

}
