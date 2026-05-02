/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCustomRepository, Repository } from 'typeorm';
import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

import { Component } from '../entities/Component';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { AppError } from '../errors/AppError';
import { WorkloadService } from './WorkloadService';
import { ComponentLog } from '../entities/ComponentLog';
import { ComponentLogRepository } from '../repositories/ComponentLogRepository';
import { ComponentStatus } from '../interfaces/ComponentStatus';
import { ComponentLogType } from '../interfaces/ComponentLogType';
import { IComponentInfoCrawler } from '../interfaces/IComponentInfoCrawler';
import { ComponentDraft } from '../entities/ComponentDraft';
import { ComponentDraftRepository } from '../repositories/ComponentDraftRepository';

export class CrawlerService {

    private componentRepository : Repository<Component>;
    private componentDraftRepository : Repository<ComponentDraft>;
    private componentLogRepository: Repository<ComponentLog>;
    private workloadService: WorkloadService;

    constructor() {
        this.componentRepository = getCustomRepository(ComponentRepository);
        this.componentDraftRepository = getCustomRepository(ComponentDraftRepository);
        this.componentLogRepository = getCustomRepository(ComponentLogRepository);
        this.workloadService = new WorkloadService();
    }

    private normalizePrerequeriments(rawValue?: string) {
        const text = rawValue?.trim();

        if (!text) {
            return 'NAO_SE_APLICA';
        }

        const codeMatches = Array.from(new Set(text.toUpperCase().match(/\b[A-Z]{2,4}[0-9]{2,4}\b/g) ?? []));

        if (codeMatches.length) {
            return codeMatches.join(', ');
        }

        if (/^(n[aã]o\s+se\s+aplica|nenhum(a)?|n\/a)$/i.test(text)) {
            return 'NAO_SE_APLICA';
        }

        return text;
    }

    private extractPrerequerimentsFromLesson($lesson: cheerio.Cheerio<any>) {
        const text = $lesson.text().replace(/\s+/g, ' ').trim();
        const directMatch = text.match(/pré-?requisitos?\s*:?\s*([^|;]+)/i);

        if (directMatch?.[1]) {
            return this.normalizePrerequeriments(directMatch[1]);
        }

        return 'NAO_SE_APLICA';
    }

    async createComponent(userId: string, data: IComponentInfoCrawler) {
        const componentExists = await this.componentRepository.findOne({
            where: { code: data.code },
        });

        if (componentExists) {
            throw new AppError('Component already exists.', 400);
        }

        try {
            const [ componentWorkload, draftWorkload ] = await Promise.all(
                new Array(2)
                    .fill(null)
                    .map(() => this.workloadService.create({
                        studentPractice: data.workload?.practice,
                        studentTheory: data.workload?.theoretical,
                        studentInternship: data.workload?.internship,
                    }))
            );

            const component = this.componentRepository.create({
                userId,
                workloadId: componentWorkload.id,
                code: data.code,
                name: data.name,
                department: data.department,
                semester: data.semester,
                program: data.description,
                objective: data.objective,
                syllabus: data.syllabus,
                bibliography: data.bibliography,
                status: ComponentStatus.PUBLISHED,
                prerequeriments: this.normalizePrerequeriments(data.prerequeriments),
                methodology: 'Não há Metodologia cadastrada',
                modality: 'Não há Modalidade cadastrada',
                learningAssessment: 'Não há Avaliação de Aprendizagem cadastrada'
            });
            await this.componentRepository.save(component);

            const draft = this.componentDraftRepository.create({
                ...component,
                id: undefined,
                workloadId: draftWorkload.id,
                status: undefined,
                componentId: component.id
            } as unknown as ComponentDraft);

            const componentLog = component.generateLog(userId, ComponentLogType.CREATION);
            await Promise.all([
                this.componentLogRepository.save(componentLog),
                this.componentDraftRepository.save(draft)
            ]);

            await this.componentRepository.save({ id: component.id, draftId: draft.id });
        }
        catch (err) {
            throw new AppError('An error has been occurred.', 400);
        }
    }

    async importComponentsFromSiac(userId: string, cdCurso: string, nuPerCursoInicial: string) {
        const listUrl =
            'https://alunoweb.ufba.br/SiacWWW/ListaDisciplinasEmentaPublico.do?cdCurso=' +
            encodeURIComponent(cdCurso) +
            '&nuPerCursoInicial=' +
            encodeURIComponent(nuPerCursoInicial);

        const options1: AxiosRequestConfig = {
            method: 'get',
            url: listUrl,
            responseType: 'arraybuffer',
            responseEncoding: 'binary',
            headers: {
                'Content-type': 'application/json'
            },
        };
        const options2: AxiosRequestConfig = {
            method: 'get',
            url: '',
            responseType: 'arraybuffer',
            responseEncoding: 'binary',
            headers: {
                'Content-type': 'application/json'
            },
        };

        function getCourseUrls($: CheerioAPI) {
            return $('table').eq(2).find('tr')
                .map((_: any, lesson: any) => {
                    const $lesson = $(lesson);
                    const href = $lesson.find('td:nth-child(3) a').attr('href');

                    if (!href || !href.includes('ExibirEmentaPublico.do')) {
                        return null;
                    }

                    return 'https://alunoweb.ufba.br' + href;
                })
                .toArray()
                .filter(Boolean);
        }

        const extractCourseInfo = ($: CheerioAPI): Array<IComponentInfoCrawler> => {
            return $('table').eq(1)
                .map((_: any, lesson: any) => {
                    const $lesson = $(lesson);

                    const content = $lesson.find('.even').children();
                    const rows = content.map((_, a) => a.children[0]);
                    const rawData: string[] = rows.map((_, x) => $(x).text().trim()).toArray();

                    if (!rawData.length || !rawData[0]) {
                        return null;
                    }

                    const [ code, componentName ] = rawData[0].split('-');

                    if (!code || !componentName) {
                        return null;
                    }

                    return {
                        code: code.trim(),
                        name: componentName.trim(),
                        department: rawData[4],
                        semester: rawData[5],
                        description: rawData[6],
                        objective: rawData[7],
                        syllabus: rawData[8],
                        bibliography: rawData[9],
                        status: ComponentStatus.PUBLISHED,
                        prerequeriments: this.extractPrerequerimentsFromLesson($lesson),
                        methodology: 'Não há Metodologia cadastrada',
                        modality: 'Não há Modalidade cadastrada',
                        learningAssessment: 'Não há Avaliação de Aprendizagem cadastrada',
                        workload: {
                            theoretical: Number(rawData[1]),
                            practice: Number(rawData[2]),
                            internship: Number(rawData[3]),
                        }
                    };
                })
                .toArray()
                .filter(Boolean) as Array<IComponentInfoCrawler>;
            };

        const { data } = await axios(options1);

        const decoder = new TextDecoder('ISO-8859-1');
        const html = decoder.decode(data);
        const $ = cheerio.load(html);
        const urlList = getCourseUrls($);
        const responses = await Promise.all(urlList.map((url) => axios({ ...options2, url })));

        for (const response of responses) {
            const pageDecoder = new TextDecoder('ISO-8859-1');
            const html = pageDecoder.decode(response.data);
            const $ = cheerio.load(html);
            const courseInfo = extractCourseInfo($);

            for (const componentData of courseInfo) {
                try {
                    await this.createComponent(userId, componentData);
                } catch (err) {
                    const appError = err as AppError;

                    if (appError.message !== 'Component already exists.') {
                        throw err;
                    }
                }
            }
        }
    }

}
