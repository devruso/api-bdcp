import { Brackets, getCustomRepository, Raw, Repository } from 'typeorm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import puppeteer from 'puppeteer';
const AdmZip = require('adm-zip');
const HTMLtoDOCX = require('html-to-docx');
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
import { AcademicLevel } from '../interfaces/AcademicLevel';

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

    private normalizeTemplateText(value: string | undefined, emptyText = 'Não se aplica') {
        const normalized = value?.trim();

        if (!normalized) {
            return emptyText;
        }

        if (/^(n[aã]o\s+se\s+aplica|n\/a|NAO_SE_APLICA)$/i.test(normalized)) {
            return 'Não se aplica';
        }

        return normalized;
    }

    private normalizeSearch(value?: string) {
        if (!value) {
            return undefined;
        }

        return value
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    private accentInsensitiveSql(column: string) {
        return `translate(LOWER(${column}), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn')`;
    }


    private async generateTemplateDocx(html: string, componentCode: string) {
        const docxBuffer = await HTMLtoDOCX(html, null, {
            title: `Plano de ensino-aprendizagem - ${componentCode}`,
            creator: 'BDCP',
            margins: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
            },
            table: {
                row: {
                    cantSplit: true,
                },
            },
        });

        return Buffer.isBuffer(docxBuffer) ? docxBuffer : Buffer.from(docxBuffer);
    }

    private convertDocxToPdf(docxBuffer: Buffer, fileBaseName: string) {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bdcp-export-'));
        const docxPath = path.join(tempDirectory, `${fileBaseName}.docx`);
        const pdfPath = path.join(tempDirectory, `${fileBaseName}.pdf`);

        fs.writeFileSync(docxPath, docxBuffer);

        const converters = [
            'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
            'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
            'soffice',
            'libreoffice',
        ];

        for (const converter of converters) {
            const command = converter;
            const args = ['--headless', '--convert-to', 'pdf', '--outdir', tempDirectory, docxPath];
            const result = spawnSync(command, args, { stdio: 'ignore' });

            if (result.status === 0 && fs.existsSync(pdfPath)) {
                const pdfBuffer = fs.readFileSync(pdfPath);
                fs.rmSync(tempDirectory, { recursive: true, force: true });

                return pdfBuffer;
            }
        }

        fs.rmSync(tempDirectory, { recursive: true, force: true });
        return null;
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

    async getComponents(options?: {
        search?: string;
        showDraft?: boolean;
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
        academicLevel?: AcademicLevel;
        department?: string;
    }) {
        const search = this.normalizeSearch(options?.search);
        const normalizedDepartment = options?.department?.trim().toLowerCase();
        const sortMap: Record<string, string> = {
            code: 'components.code',
            name: 'components.name',
            department: 'components.department',
            academicLevel: 'components.academicLevel',
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
                    .where(`${this.accentInsensitiveSql('components.code')} LIKE :search`, { search: `%${search}%` })
                    .orWhere(`${this.accentInsensitiveSql('components.name')} LIKE :search`, { search: `%${search}%` });
            }));
        }

        if (options?.academicLevel) {
            query.andWhere('components.academicLevel = :academicLevel', {
                academicLevel: options.academicLevel,
            });
        }

        if (normalizedDepartment) {
            query.andWhere(
                `${this.accentInsensitiveSql('components.department')} = :department`,
                { department: normalizedDepartment }
            );
        }

        const components = await query
            .orderBy(sortBy, sortOrder)
            .addOrderBy('logs.createdAt', 'DESC')
            .getMany();

        return components;
    }

    async getComponentByCode(code: string) {
        const normalizedCode = code.trim().toLowerCase();

        const component = await this.componentRepository
            .createQueryBuilder('components')
            .leftJoinAndSelect('components.draft', 'draft')
            .leftJoinAndSelect('components.logs', 'logs')
            .leftJoinAndSelect('components.workload', 'workload')
            .leftJoinAndSelect('draft.workload', 'draft_workload')
            .leftJoinAndSelect('logs.user', 'logs_user')
            .where({
                code: Raw((alias) => `LOWER(${alias}) = :code`, {
                    code: normalizedCode,
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
        const normalizedCode = requestDto.code.trim().toUpperCase();
        const componentExists = await this.componentRepository.findOne({
            where: { code: normalizedCode },
        });

        if (componentExists) {
            throw new AppError('Component already exists.', 400);
        }

        try {
            const componentDto = {
                ...requestDto,
                code: normalizedCode,
                prerequeriments: await this.normalizeAndValidatePrerequeriments(
                    requestDto.prerequeriments,
                    normalizedCode
                ),
                userId: userId,
            };

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

        const nextCode = componentDto.code?.trim().toUpperCase();

        const codeComponent =
            nextCode && nextCode !== componentExists.code
                ? await this.componentRepository.findOne({
                    where: { code: nextCode },
                })
                : null;
        if (codeComponent) {
            throw new AppError('Invalid code', 400);
        }

        try {
            if (nextCode) {
                componentDto.code = nextCode;
            }

            if (componentDto.prerequeriments !== undefined) {
                componentDto.prerequeriments = await this.normalizeAndValidatePrerequeriments(
                    componentDto.prerequeriments,
                    nextCode ?? componentExists.code
                );
            }

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

    async export(id: string, format: 'pdf' | 'doc' | 'docx' = 'pdf') {
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

        const data: Parameters<typeof generateHtml>[0] = {
            ...component,
            approval: latestApprovalLog
                ? {
                    agreementNumber: latestApprovalLog.agreementNumber,
                    agreementDate: latestApprovalLog.agreementDate,
                    approvedBy: latestApprovalLog.user?.name,
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
            exportMode: format === 'pdf' ? 'pdf' : 'docx',
        };

        const html = generateHtml(data);
        const templateDocx = await this.generateTemplateDocx(html, component.code);

        if (format === 'doc' || format === 'docx') {
            return {
                buffer: templateDocx,
                contentType:
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                fileName: `${component.code}.docx`,
            };
        }

        const convertedPdf = this.convertDocxToPdf(templateDocx, component.code);

        if (convertedPdf) {
            return {
                buffer: convertedPdf,
                contentType: 'application/pdf',
                fileName: `${component.code}.pdf`,
            };
        }

        const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: chromiumPath || undefined,
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

        return {
            buffer: pdf,
            contentType: 'application/pdf',
            fileName: `${component.code}.pdf`,
        };
    }
}
