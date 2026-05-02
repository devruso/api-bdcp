import { Brackets, getCustomRepository, Raw, Repository } from 'typeorm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import puppeteer from 'puppeteer';
const AdmZip = require('adm-zip');
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

    private resolveDocxTemplatePath() {
        const configuredTemplatePath = process.env.DOCX_TEMPLATE_PATH?.trim();
        const configuredCandidates = configuredTemplatePath
            ? [
                path.isAbsolute(configuredTemplatePath)
                    ? configuredTemplatePath
                    : path.resolve(process.cwd(), configuredTemplatePath),
                path.resolve(__dirname, configuredTemplatePath),
            ]
            : [];

        const defaultCandidates = [
            path.resolve(process.cwd(), 'UFBA_TEMPLATE.docx'),
            path.resolve(process.cwd(), 'IC045.docx'),
            path.resolve(__dirname, '../../UFBA_TEMPLATE.docx'),
            path.resolve(__dirname, '../../IC045.docx'),
            path.resolve(__dirname, '../../../UFBA_TEMPLATE.docx'),
            path.resolve(__dirname, '../../../IC045.docx'),
        ];

        const uniqueCandidates = Array.from(new Set([
            ...configuredCandidates,
            ...defaultCandidates,
        ]));

        return uniqueCandidates.find((candidatePath) => fs.existsSync(candidatePath));
    }

    private escapeXml(value: string) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
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

    private replaceByPrefix(xml: string, prefix: string, content: string) {
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`<w:t(?: xml:space="preserve")?>${escapedPrefix}[\\s\\S]*?<\\/w:t>`);

        return xml.replace(
            pattern,
            `<w:t xml:space="preserve">${this.escapeXml(content)}</w:t>`
        );
    }

    private replaceToken(xml: string, token: string, content: string) {
        const escapedContent = this.escapeXml(content);

        return xml.split(token).join(escapedContent);
    }

    private replaceByTokenOrPrefix(xml: string, token: string, fallbackPrefix: string, content: string) {
        if (xml.includes(token)) {
            return this.replaceToken(xml, token, content);
        }

        return this.replaceByPrefix(xml, fallbackPrefix, content);
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

    private generateTemplateDocx(component: Component, data: {
        semester: string;
        department: string;
        prerequeriments: string;
        syllabus: string;
        objective: string;
        program: string;
        methodology: string;
        learningAssessment: string;
        bibliography: string;
    }) {
        const templatePath = this.resolveDocxTemplatePath();

        if (!templatePath) {
            throw new AppError(
                'Template DOCX não encontrado para exportação. Configure DOCX_TEMPLATE_PATH ou adicione UFBA_TEMPLATE.docx na raiz da API.',
                500
            );
        }

        const zip = new AdmZip(templatePath);
        let xml = zip.readAsText('word/document.xml');

        const replacementMap: Array<[string, string]> = [
            ['{{COMPONENT_CODE}}', component.code],
            ['{{COMPONENT_NAME}}', this.normalizeTemplateText(component.name, 'Não informado')],
            ['{{DEPARTMENT}}', this.normalizeTemplateText(data.department, 'Não informado')],
            ['{{SEMESTER}}', this.normalizeTemplateText(data.semester, '____._')],
            ['{{PREREQUERIMENTS}}', this.normalizeTemplateText(data.prerequeriments, 'Não se aplica')],
            ['IC045', component.code],
            ['Tópicos em Sistemas de Informação e Web I', this.normalizeTemplateText(component.name, 'Não informado')],
            ['CIÊNCIA DA COMPUTAÇÃO', this.normalizeTemplateText(data.department, 'Não informado')],
            ['Semestre 2024.2', `Semestre ${this.normalizeTemplateText(data.semester, '____._')}`],
            ['Semestre 2024.1', `Semestre ${this.normalizeTemplateText(data.semester, '____._')}`],
            ['Não se aplica', this.normalizeTemplateText(data.prerequeriments, 'Não se aplica')],
        ];

        replacementMap.forEach(([fromValue, toValue]) => {
            xml = xml.split(fromValue).join(this.escapeXml(toValue));
        });

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{SYLLABUS}}',
            'Abordagens de temas atuais, circunstanciais e/ou inovadores de problemas relacionados à área de Web e Sistemas de Informação.',
            this.normalizeTemplateText(data.syllabus, 'Não informado')
        );

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{OBJECTIVE}}',
            'OBJETIVO GERAL',
            this.normalizeTemplateText(data.objective, 'Não informado')
        );

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{PROGRAM}}',
            '1\nApresentação da Disciplina',
            this.normalizeTemplateText(data.program, 'Não informado')
        );

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{METHODOLOGY}}',
            'A metodologia de ensino adotada favorece o desenvolvimento da visão sistêmica do processo de desenvolvimento de aplicações web, que consiste em avaliar criticamente e sob diferentes aspectos todo o processo.',
            this.normalizeTemplateText(data.methodology, 'Não informado')
        );

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{LEARNING_ASSESSMENT}}',
            'As avaliações ocorrerão de modo individual ou em grupo e poderão ser utilizados recursos/instrumentos apropriados como questionários, lista de exercícios, produção de textos colaborativos, resolução de problemas em grupo. As avaliações ocorrerão através da resolução de atividades assíncronas',
            this.normalizeTemplateText(data.learningAssessment, 'Não informado')
        );

        xml = this.replaceByTokenOrPrefix(
            xml,
            '{{BIBLIOGRAPHY}}',
            'Desenvolvendo Aplicações Web com JSP, Servlets Edson Gonçalves, Ciencia Moderna, 2007.',
            this.normalizeTemplateText(data.bibliography, 'Não informado')
        );

        zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));

        return zip.toBuffer();
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
    }) {
        const search = this.normalizeSearch(options?.search);
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
                    .where(`${this.accentInsensitiveSql('components.code')} LIKE :search`, { search: `%${search}%` })
                    .orWhere(`${this.accentInsensitiveSql('components.name')} LIKE :search`, { search: `%${search}%` });
            }));
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

        const templateDocx = this.generateTemplateDocx(component, {
            semester: component.semester,
            department: component.department,
            prerequeriments: component.prerequeriments,
            syllabus: component.syllabus,
            objective: component.objective,
            program: component.program,
            methodology: component.methodology,
            learningAssessment: component.learningAssessment,
            bibliography: component.bibliography,
        });

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

        const html = generateHtml(data);

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
