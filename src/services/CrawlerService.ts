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
import { AcademicLevel } from '../interfaces/AcademicLevel';
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

    private normalizeDepartmentLabel(rawDepartment: string, sourceType: 'department' | 'program') {
        const normalized = rawDepartment.replace(/\s+/g, ' ').trim();

        if (normalized) {
            return normalized;
        }

        return sourceType === 'department' ? 'Departamento SIGAA' : 'Programa SIGAA';
    }

    private getSigaaSourceUrls(
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ): string[] {
        const encodedId = encodeURIComponent(sourceId);
        const nivel = academicLevel === AcademicLevel.GRADUATION
            ? 'G'
            : academicLevel === AcademicLevel.MASTERS
                ? 'E'
                : 'D';

        if (sourceType === 'department') {
            return [
                `https://sigaa.ufba.br/sigaa/public/departamento/componentes.jsf?id=${encodedId}`,
                `https://sigaa.ufba.br/sigaa/public/departamento/portal.jsf?id=${encodedId}&lc=pt_BR`,
                `https://sigaa.ufba.br/sigaa/public/curso/curriculo.jsf?id=${encodedId}&lc=pt_BR&nivel=${nivel}`,
            ];
        }

        return [
            `https://sigaa.ufba.br/sigaa/public/programa/curriculo.jsf?lc=pt_BR&id=${encodedId}`,
            `https://sigaa.ufba.br/sigaa/public/curso/curriculo.jsf?id=${encodedId}&lc=pt_BR&nivel=${nivel}`,
            `https://sigaa.ufba.br/sigaa/public/departamento/componentes.jsf?id=${encodedId}`,
        ];
    }

    private getSigaaSearchLevel(academicLevel: AcademicLevel): 'G' | 'S' {
        return academicLevel === AcademicLevel.GRADUATION ? 'G' : 'S';
    }

    private async searchSigaaComponentsByUnit(
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ): Promise<Array<IComponentInfoCrawler>> {
        const nivel = this.getSigaaSearchLevel(academicLevel);
        const formPageResponse = await axios.get<ArrayBuffer>('https://sigaa.ufba.br/sigaa/public/componentes/busca_componentes.jsf', {
            responseType: 'arraybuffer',
            responseEncoding: 'binary',
        });

        const decoder = new TextDecoder('ISO-8859-1');
        const formHtml = decoder.decode(formPageResponse.data);
        const $formPage = cheerio.load(formHtml);

        const formId = $formPage('form').first().attr('id') || 'form';
        const action = $formPage('form').first().attr('action') || '/sigaa/public/componentes/busca_componentes.jsf';
        const viewState = $formPage('input[name="javax.faces.ViewState"]').first().attr('value') || '';
        const actionUrl = new URL(action, 'https://sigaa.ufba.br').toString();

        const payload = new URLSearchParams();
        payload.set(formId, formId);
        payload.set(`${formId}:nivel`, nivel);
        payload.set(`${formId}:checkTipo`, 'on');
        payload.set(`${formId}:tipo`, '2');
        payload.set(`${formId}:checkUnidade`, 'on');
        payload.set(`${formId}:unidades`, sourceId);
        payload.set(`${formId}:btnBuscarComponentes`, 'Buscar Componentes');

        if (viewState) {
            payload.set('javax.faces.ViewState', viewState);
        }

        const searchResponse = await axios.post<ArrayBuffer>(actionUrl, payload.toString(), {
            responseType: 'arraybuffer',
            responseEncoding: 'binary',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const searchHtml = decoder.decode(searchResponse.data);
        const $searchPage = cheerio.load(searchHtml);

        return this.extractSigaaListRows($searchPage, sourceType, academicLevel);
    }

    private findCodeFromRowCells(cells: string[]): string | null {
        for (const cell of cells.slice(0, 2)) {
            const match = cell.match(/(^|[^A-Z0-9])([A-Z]{2,6}[0-9]{2,4})(?=[^A-Z0-9]|$)/);

            if (match?.[2]) {
                return match[2].toUpperCase();
            }
        }

        return null;
    }

    private extractSigaaListRows(
        $: CheerioAPI,
        sourceType: 'department' | 'program',
        academicLevel: AcademicLevel
    ): Array<IComponentInfoCrawler> {
        const foundItems = new Map<string, IComponentInfoCrawler>();
        const pageDepartmentLabel =
            $('h1, h2')
                .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
                .toArray()
                .find((text) => /departamento|programa|computa|informa/i.test(text)) || '';

        $('tr').each((_, row) => {
            const $row = $(row);
            const rowCells = $row
                .find('td')
                .map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
                .toArray()
                .filter(Boolean);

            // Ignore layout rows and JSF scaffolding rows that do not represent components.
            if (rowCells.length < 2) {
                return;
            }

            const code = this.findCodeFromRowCells(rowCells);

            if (!code) {
                return;
            }

            if (foundItems.has(code)) {
                return;
            }

            const nameCell = rowCells
                .slice(0, 3)
                .find((cell) => !cell.includes(code) && cell.length >= 4);
            const rawName = (nameCell || rowCells.join(' '))
                .replace(code, '')
                .replace(/^[-:\s]+/, '')
                .replace(/\s+CH\s+.*/i, '')
                .trim();
            const name = (rawName || `Disciplina ${code}`).slice(0, 255);

            const departmentCell = rowCells.find((cell) => /\b(departamento|instituto)\b/i.test(cell));
            const programCell = sourceType === 'program'
                ? rowCells.find((cell) => /\bprograma\b/i.test(cell) && !/\/[A-Z]{2,6}[0-9]{2,4}/i.test(cell))
                : undefined;

            const department = this.normalizeDepartmentLabel(
                departmentCell || programCell || pageDepartmentLabel,
                sourceType
            );

            foundItems.set(code, {
                code,
                name,
                department,
                semester: '',
                description: 'Conteúdo programático definido internamente no BDCP.',
                objective: '',
                syllabus: 'Ementa importada do SIGAA público.',
                bibliography: '',
                prerequeriments: 'NAO_SE_APLICA',
                methodology: 'Definida internamente no BDCP.',
                modality: sourceType === 'department' ? 'Presencial' : 'Programa acadêmico',
                learningAssessment: 'Definida internamente no BDCP.',
                academicLevel,
                workload: {
                    theoretical: 0,
                    practice: 0,
                    internship: 0,
                },
            });
        });

        return Array.from(foundItems.values());
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
                academicLevel: data.academicLevel ?? AcademicLevel.GRADUATION,
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

    async importComponentsFromSigaaPublic(
        userId: string,
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ) {
        const normalizedSourceId = String(sourceId).trim();

        if (!normalizedSourceId) {
            throw new AppError('Invalid SIGAA source id.', 400);
        }

        const sourceUrls = this.getSigaaSourceUrls(sourceType, normalizedSourceId, academicLevel);
        let componentsInfo: Array<IComponentInfoCrawler> = [];

        for (const sourceUrl of sourceUrls) {
            const { data } = await axios.get<ArrayBuffer>(sourceUrl, {
                responseType: 'arraybuffer',
                responseEncoding: 'binary',
            });

            const decoder = new TextDecoder('ISO-8859-1');
            const html = decoder.decode(data);
            const $ = cheerio.load(html);

            componentsInfo = this.extractSigaaListRows($, sourceType, academicLevel);

            if (componentsInfo.length > 0) {
                break;
            }
        }

        if (componentsInfo.length === 0) {
            componentsInfo = await this.searchSigaaComponentsByUnit(sourceType, normalizedSourceId, academicLevel);
        }

        if (componentsInfo.length === 0) {
            throw new AppError('No components found in SIGAA public source.', 404);
        }

        for (const componentData of componentsInfo) {
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
