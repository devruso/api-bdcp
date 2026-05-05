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
import { ComponentRelation } from '../entities/ComponentRelation';
import { ComponentRelationRepository } from '../repositories/ComponentRelationRepository';
import { ComponentRelationType } from '../interfaces/ComponentRelationType';

export interface ImportComponentsSummary {
    source: 'siac' | 'sigaa-public';
    requested: number;
    created: number;
    skippedExisting: number;
    failed: number;
    failures: string[];
}

type SigaaComponentDetail = {
    prerequeriments?: string;
    coRequisites?: string[];
    equivalences?: string[];
    syllabus?: string;
    objective?: string;
    methodology?: string;
    learningAssessment?: string;
    workload?: {
        theoretical: number;
        practice: number;
        internship: number;
        extension?: number;
    };
};

type SigaaJsfFormContext = {
    formId: string;
    actionUrl: string;
    hiddenInputs: Record<string, string>;
};

type SigaaDetailRawFields = {
    prerequeriments?: string;
    coReqRaw?: string;
    equivalencesRaw?: string;
    syllabus?: string;
    objective?: string;
    methodology?: string;
    learningAssessment?: string;
};

const SIGAA_LABEL_MATCHERS = {
    prerequeriments: /^(pre\s*requisit(?:o|os)|prerequisit(?:o|os))$/i,
    coReqRaw: /^(co\s*requisit(?:o|os)|correquisit(?:o|os))$/i,
    equivalencesRaw: /^(equivalenc(?:ia|ias)|equivalente(?:\(s\))?)$/i,
    syllabus: /^ementa$/i,
    objective: /^objetiv(?:o|os)$/i,
    methodology: /^metodologia$/i,
    learningAssessment: /^(avaliac(?:ao|ao\s+da\s+aprendizagem)|avaliacao\s+da\s+aprendizagem)$/i,
};

export class CrawlerService {

    private componentRepository : Repository<Component>;
    private componentDraftRepository : Repository<ComponentDraft>;
    private componentLogRepository: Repository<ComponentLog>;
    private componentRelationRepository: Repository<ComponentRelation>;
    private workloadService: WorkloadService;
    private sigaaDetailCache = new Map<string, SigaaComponentDetail | null>();
    private sigaaDetailInFlight = new Map<string, Promise<SigaaComponentDetail | null>>();

    constructor() {
        this.componentRepository = getCustomRepository(ComponentRepository);
        this.componentDraftRepository = getCustomRepository(ComponentDraftRepository);
        this.componentLogRepository = getCustomRepository(ComponentLogRepository);
        this.componentRelationRepository = getCustomRepository(ComponentRelationRepository);
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

        if (/^(n[aã]o\s+se\s+aplica|n[aã]o\s+h[aá]|nenhum(a)?|n\/a)$/i.test(text)) {
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

    private extractSigaaWorkloadHours(rowCells: string[]): number {
        const hourMatch = rowCells
            .map((cell) => cell.match(/(\d{1,3})\s*h\b/i))
            .find((match) => !!match?.[1]);

        if (!hourMatch?.[1]) {
            return 0;
        }

        return Number(hourMatch[1]) || 0;
    }

    private extractSigaaComponentType(rowCells: string[]): string {
        const knownType = rowCells.find((cell) => /^(DISCIPLINA|ATIVIDADE|MODULO|M[ÓO]DULO)$/i.test(cell.trim()));

        if (knownType) {
            return knownType.trim();
        }

        return 'DISCIPLINA';
    }

    private normalizeSigaaDetailUrl(rawHref?: string): string | undefined {
        if (!rawHref) {
            return undefined;
        }

        if (/^javascript:/i.test(rawHref)) {
            return undefined;
        }

        if (rawHref.trim().startsWith('#')) {
            return undefined;
        }

        try {
            return new URL(rawHref, 'https://sigaa.ufba.br').toString();
        } catch {
            return undefined;
        }
    }

    private parseSigaaJsfOnclickInvocation(onclick: string): {
        formId: string;
        params: Record<string, string>;
    } | null {
        const callMatch = onclick.match(/jsfcljs\(document\.getElementById\('([^']+)'\),\{([^}]*)\}/);

        if (!callMatch?.[1] || !callMatch?.[2]) {
            return null;
        }

        const params: Record<string, string> = {};
        const pairRegex = /'([^']+)'\s*:\s*'([^']*)'/g;
        let pairMatch = pairRegex.exec(callMatch[2]);

        while (pairMatch) {
            params[pairMatch[1]] = pairMatch[2];
            pairMatch = pairRegex.exec(callMatch[2]);
        }

        return {
            formId: callMatch[1],
            params,
        };
    }

    private buildSigaaFormContexts($: CheerioAPI): Map<string, SigaaJsfFormContext> {
        const contexts = new Map<string, SigaaJsfFormContext>();

        $('form').each((_, form) => {
            const $form = $(form);
            const formId = $form.attr('id');

            if (!formId) {
                return;
            }

            const action = $form.attr('action') || '';
            const actionUrl = this.normalizeSigaaDetailUrl(action)
                || this.normalizeSigaaDetailUrl('/sigaa/public/componentes/busca_componentes.jsf')
                || 'https://sigaa.ufba.br/sigaa/public/componentes/busca_componentes.jsf';
            const hiddenInputs: Record<string, string> = {};

            hiddenInputs[formId] = formId;

            $form.find('input[name]').each((__, input) => {
                const name = $(input).attr('name');
                const value = $(input).attr('value') || '';

                if (name) {
                    hiddenInputs[name] = value;
                }
            });

            contexts.set(formId, {
                formId,
                actionUrl,
                hiddenInputs,
            });
        });

        return contexts;
    }

    private extractSigaaDetailActionFromRow(
        $: CheerioAPI,
        $row: cheerio.Cheerio<any>,
        formContexts: Map<string, SigaaJsfFormContext>
    ): { detailActionUrl?: string; detailActionPayload?: string } {
        const onclickValues = $row
            .find('a[onclick]')
            .map((_, anchor) => String($(anchor).attr('onclick') || ''))
            .toArray();

        for (const onclick of onclickValues) {
            if (!/idComponente/i.test(onclick)) {
                continue;
            }

            const parsed = this.parseSigaaJsfOnclickInvocation(onclick);

            if (!parsed) {
                continue;
            }

            const formContext = formContexts.get(parsed.formId);

            if (!formContext) {
                continue;
            }

            const payload = new URLSearchParams();

            Object.entries(formContext.hiddenInputs).forEach(([key, value]) => {
                payload.set(key, value);
            });
            Object.entries(parsed.params).forEach(([key, value]) => {
                payload.set(key, value);
            });

            return {
                detailActionUrl: formContext.actionUrl,
                detailActionPayload: payload.toString(),
            };
        }

        return {};
    }

    private normalizeCodeList(rawValue?: string): string[] {
        const text = String(rawValue || '').trim();

        if (!text) {
            return [];
        }

        if (/(n[aã]o\s+h[aá]|nenhum(a)?|n\/a|n[aã]o\s+se\s+aplica)/i.test(text)) {
            return [];
        }

        const codes = Array.from(new Set(text.toUpperCase().match(/\b[A-Z]{2,6}[0-9]{2,4}\b/g) ?? []));

        if (codes.length) {
            return codes;
        }

        return [];
    }

    private extractFieldFromDetailText(text: string, labelVariants: string[], stopLabels: string[]): string {
        const escapedLabels = labelVariants.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const escapedStops = stopLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        const regex = new RegExp(
            `\\b(?:${escapedLabels.join('|')})\\b\\s*(?::|-|–|—)?\\s*(.+?)(?=\\b(?:${escapedStops.join('|')})\\b(?:\\s*(?::|-|–|—))?|$)`,
            'i'
        );
        const match = text.match(regex);

        if (!match?.[1]) {
            return '';
        }

        return match[1].replace(/\s+/g, ' ').trim();
    }

    private normalizeSigaaLabel(rawLabel: string): string {
        return rawLabel
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[:\-–—]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    private assignSigaaDetailFieldByLabel(
        target: SigaaDetailRawFields,
        rawLabel: string,
        rawValue: string
    ) {
        const label = this.normalizeSigaaLabel(rawLabel);
        const value = String(rawValue || '').replace(/\s+/g, ' ').trim();

        if (!label || !value) {
            return;
        }

        if (!target.prerequeriments && SIGAA_LABEL_MATCHERS.prerequeriments.test(label)) {
            target.prerequeriments = value;
            return;
        }
        if (!target.coReqRaw && SIGAA_LABEL_MATCHERS.coReqRaw.test(label)) {
            target.coReqRaw = value;
            return;
        }
        if (!target.equivalencesRaw && SIGAA_LABEL_MATCHERS.equivalencesRaw.test(label)) {
            target.equivalencesRaw = value;
            return;
        }
        if (!target.syllabus && SIGAA_LABEL_MATCHERS.syllabus.test(label)) {
            target.syllabus = value;
            return;
        }
        if (!target.objective && SIGAA_LABEL_MATCHERS.objective.test(label)) {
            target.objective = value;
            return;
        }
        if (!target.methodology && SIGAA_LABEL_MATCHERS.methodology.test(label)) {
            target.methodology = value;
            return;
        }
        if (!target.learningAssessment && SIGAA_LABEL_MATCHERS.learningAssessment.test(label)) {
            target.learningAssessment = value;
        }
    }

    private extractSigaaStructuredDetailFields($: CheerioAPI): SigaaDetailRawFields {
        const fields: SigaaDetailRawFields = {};

        $('table tr').each((_, tr) => {
            const $cells = $(tr).find('th, td');
            if ($cells.length < 2) {
                return;
            }

            const label = $($cells[0]).text();
            const value = $($cells[1]).text();
            this.assignSigaaDetailFieldByLabel(fields, label, value);
        });

        $('dl').each((_, dl) => {
            const $dl = $(dl);
            const terms = $dl.find('dt').toArray();

            for (const term of terms) {
                const $term = $(term);
                const value = $term.next('dd').text();
                this.assignSigaaDetailFieldByLabel(fields, $term.text(), value);
            }
        });

        $('p, li, div').each((_, node) => {
            const text = $(node).text().replace(/\s+/g, ' ').trim();

            if (!text || text.length < 8) {
                return;
            }

            const pair = text.match(/^([^:–—-]{3,80})\s*(?::|-|–|—)\s*(.+)$/);

            if (!pair?.[1] || !pair?.[2]) {
                return;
            }

            this.assignSigaaDetailFieldByLabel(fields, pair[1], pair[2]);
        });

        return fields;
    }

    private parseSigaaComponentDetailPage($: CheerioAPI): SigaaComponentDetail {
        const pageText = $('body').text().replace(/\s+/g, ' ').trim();
        const structuredFields = this.extractSigaaStructuredDetailFields($);
        const stopLabels = [
            'Pré-Requisitos',
            'Pre-Requisitos',
            'Pré Requisitos',
            'Pre Requisitos',
            'Pré-Requisito',
            'Pre-Requisito',
            'Co-Requisitos',
            'Correquísitos',
            'Co Requisitos',
            'Correquisitos',
            'Co-Requisito',
            'Correquisito',
            'Equivalências',
            'Equivalencias',
            'Equivalente(s)',
            'Equivalente',
            'Ementa',
            'Objetivos',
            'Objetivo',
            'Metodologia',
            'Avaliação',
            'Avaliacao',
            'Avaliação da Aprendizagem',
            'Avaliacao da Aprendizagem',
            'Carga Horária',
            'Carga Horaria',
            'Bibliografia',
            'Teórica',
            'Teorica',
            'Prática',
            'Pratica',
            'Estágio',
            'Estagio',
            'Extensão',
            'Extensao',
        ];

        const prerequeriments = structuredFields.prerequeriments || this.extractFieldFromDetailText(
            pageText,
            ['Pré-Requisitos', 'Pre-Requisitos', 'Pré Requisitos', 'Pre Requisitos', 'Pré-Requisito', 'Pre-Requisito'],
            stopLabels
        );
        const coReqRaw = structuredFields.coReqRaw || this.extractFieldFromDetailText(
            pageText,
            ['Co-Requisitos', 'Correquísitos', 'Co Requisitos', 'Correquisitos', 'Co-Requisito', 'Correquisito'],
            stopLabels
        );
        const equivalencesRaw = structuredFields.equivalencesRaw || this.extractFieldFromDetailText(
            pageText,
            ['Equivalências', 'Equivalencias', 'Equivalente(s)', 'Equivalente'],
            stopLabels
        );
        const syllabus = structuredFields.syllabus || this.extractFieldFromDetailText(pageText, ['Ementa'], stopLabels);
        const objective = structuredFields.objective || this.extractFieldFromDetailText(pageText, ['Objetivos', 'Objetivo'], stopLabels);
        const methodology = structuredFields.methodology || this.extractFieldFromDetailText(pageText, ['Metodologia'], stopLabels);
        const learningAssessment = structuredFields.learningAssessment || this.extractFieldFromDetailText(
            pageText,
            ['Avaliação', 'Avaliacao', 'Avaliação da Aprendizagem', 'Avaliacao da Aprendizagem'],
            stopLabels
        );

        const extractHours = (patterns: RegExp[]) => {
            for (const pattern of patterns) {
                const match = pageText.match(pattern);

                if (match?.[1]) {
                    return Number(match[1]) || 0;
                }
            }

            return 0;
        };

        const theoretical = extractHours([/te[oó]rica\s*:?\s*(\d{1,3})(?:\s*h)?/i]);
        const practice = extractHours([/pr[aá]tica\s*:?\s*(\d{1,3})(?:\s*h)?/i]);
        const internship = extractHours([/est[aá]gio\s*:?\s*(\d{1,3})(?:\s*h)?/i]);
        const extension = extractHours([
            /extens[aã]o\s*:?\s*(\d{1,3})(?:\s*h)?/i,
            /carga\s*hor[aá]ria\s*de\s*extens[aã]o\s*:?\s*(\d{1,3})(?:\s*h)?/i,
        ]);

        return {
            prerequeriments: prerequeriments ? this.normalizePrerequeriments(prerequeriments) : undefined,
            coRequisites: this.normalizeCodeList(coReqRaw),
            equivalences: this.normalizeCodeList(equivalencesRaw),
            syllabus: syllabus || undefined,
            objective: objective || undefined,
            methodology: methodology || undefined,
            learningAssessment: learningAssessment || undefined,
            workload: {
                theoretical,
                practice,
                internship,
                extension,
            },
        };
    }

    private getDetailCacheKey(component: IComponentInfoCrawler): string {
        const componentIdentifier = this.extractSigaaComponentIdentifier(component);

        if (componentIdentifier) {
            return `id:${componentIdentifier}`;
        }

        if (component.detailUrl) {
            return `url:${component.detailUrl}`;
        }

        if (component.detailActionPayload) {
            const idComponente = component.detailActionPayload.match(/(?:^|&)idComponente=([^&]+)/i)?.[1];

            if (idComponente) {
                return `id:${idComponente}`;
            }

            return `payload:${component.detailActionPayload}`;
        }

        return `code:${component.code}`;
    }

    private extractSigaaComponentIdentifier(component: IComponentInfoCrawler): string | undefined {
        const payloadId = component.detailActionPayload?.match(/(?:^|&)idComponente=([^&]+)/i)?.[1];

        if (payloadId) {
            return decodeURIComponent(payloadId);
        }

        if (!component.detailUrl) {
            return undefined;
        }

        try {
            const detailUrl = new URL(component.detailUrl);
            const urlId = detailUrl.searchParams.get('idComponente')
                || detailUrl.searchParams.get('id')
                || detailUrl.searchParams.get('componente');

            return urlId ? decodeURIComponent(urlId) : undefined;
        } catch {
            return undefined;
        }
    }

    private async getOrFetchSigaaComponentDetail(
        cacheKey: string,
        component: IComponentInfoCrawler,
        detailCache: Map<string, SigaaComponentDetail | null>,
        inFlightCache: Map<string, Promise<SigaaComponentDetail | null>>
    ): Promise<SigaaComponentDetail | null> {
        if (detailCache.has(cacheKey)) {
            return detailCache.get(cacheKey) || null;
        }

        const existingRequest = inFlightCache.get(cacheKey);

        if (existingRequest) {
            return existingRequest;
        }

        const request = this.fetchSigaaComponentDetail(component)
            .then((detail) => {
                detailCache.set(cacheKey, detail);
                return detail;
            })
            .finally(() => {
                inFlightCache.delete(cacheKey);
            });

        inFlightCache.set(cacheKey, request);

        return request;
    }

    private applySigaaDetailToComponent(
        component: IComponentInfoCrawler,
        detail: SigaaComponentDetail
    ) {
        if (detail.prerequeriments) {
            component.prerequeriments = detail.prerequeriments;
        }
        if (detail.syllabus) {
            component.syllabus = detail.syllabus;
        }
        if (detail.objective) {
            component.objective = detail.objective;
        }
        if (detail.methodology) {
            component.methodology = detail.methodology;
        }
        if (detail.learningAssessment) {
            component.learningAssessment = detail.learningAssessment;
        }
        if (detail.workload) {
            const fallback = component.workload || { theoretical: 0, practice: 0, internship: 0 };
            component.workload = {
                theoretical: detail.workload.theoretical || fallback.theoretical || 0,
                practice: detail.workload.practice || fallback.practice || 0,
                internship: detail.workload.internship || fallback.internship || 0,
            };

            if (typeof detail.workload.extension === 'number') {
                component.workloadExtension = detail.workload.extension;
            }
        }

        if (detail.coRequisites?.length) {
            component.coRequisites = detail.coRequisites;
        }

        if (detail.equivalences?.length) {
            component.equivalences = detail.equivalences;
        }
    }

    private async fetchSigaaComponentDetail(component: IComponentInfoCrawler): Promise<SigaaComponentDetail | null> {
        try {
            let response: { data: ArrayBuffer };

            if (component.detailUrl) {
                response = await axios.get<ArrayBuffer>(component.detailUrl, {
                    responseType: 'arraybuffer',
                    responseEncoding: 'binary',
                });
            } else if (component.detailActionUrl && component.detailActionPayload) {
                response = await axios.post<ArrayBuffer>(component.detailActionUrl, component.detailActionPayload, {
                    responseType: 'arraybuffer',
                    responseEncoding: 'binary',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                });
            } else {
                return null;
            }

            const decoder = new TextDecoder('ISO-8859-1');
            const html = decoder.decode(response.data);
            const $ = cheerio.load(html);

            return this.parseSigaaComponentDetailPage($);
        } catch {
            return null;
        }
    }

    async enrichSigaaComponentsFromPublicDetails(
        components: Array<IComponentInfoCrawler>,
        concurrency = 4
    ): Promise<Array<IComponentInfoCrawler>> {
        const normalizedConcurrency = Math.max(1, concurrency);
        const detailCache = this.sigaaDetailCache || new Map<string, SigaaComponentDetail | null>();
        const inFlightCache = this.sigaaDetailInFlight || new Map<string, Promise<SigaaComponentDetail | null>>();
        this.sigaaDetailCache = detailCache;
        this.sigaaDetailInFlight = inFlightCache;
        const enriched = [...components];
        let cursor = 0;

        const workers = new Array(normalizedConcurrency).fill(null).map(async () => {
            while (cursor < enriched.length) {
                const index = cursor;
                cursor += 1;
                const current = enriched[index];

                if (!current.detailUrl && !current.detailActionPayload) {
                    continue;
                }

                const cacheKey = this.getDetailCacheKey(current);
                if (detailCache.has(cacheKey)) {
                    const cachedDetail = detailCache.get(cacheKey);

                    if (cachedDetail) {
                        this.applySigaaDetailToComponent(current, cachedDetail);
                    }
                    continue;
                }

                const detail = await this.getOrFetchSigaaComponentDetail(
                    cacheKey,
                    current,
                    detailCache,
                    inFlightCache
                );

                if (!detail) {
                    continue;
                }

                this.applySigaaDetailToComponent(current, detail);
            }
        });

        await Promise.all(workers);
        return enriched;
    }

    private extractSigaaListRows(
        $: CheerioAPI,
        sourceType: 'department' | 'program',
        academicLevel: AcademicLevel
    ): Array<IComponentInfoCrawler> {
        const foundItems = new Map<string, IComponentInfoCrawler>();
        const formContexts = this.buildSigaaFormContexts($);
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

            const rowClass = String($row.attr('class') || '').toLowerCase();
            const hasResultRowClass = /linha(par|impar)/.test(rowClass);

            if (!hasResultRowClass && rowCells.length < 3) {
                return;
            }

            const code = this.findCodeFromRowCells(rowCells);

            if (!code) {
                return;
            }

            if (rowCells.some((cell) => /n[íi]vel de ensino|tipo do componente|unidade respons[aá]vel/i.test(cell))) {
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

            const totalHours = this.extractSigaaWorkloadHours(rowCells);
            const componentType = this.extractSigaaComponentType(rowCells);
            const detailHref =
                $row
                    .find('a')
                    .map((__, anchor) => $(anchor).attr('href') || '')
                    .toArray()
                    .find((href) => /componente|curriculo|programa|portal\.jsf/i.test(href));
            const detailUrl = this.normalizeSigaaDetailUrl(detailHref);
            const detailAction = this.extractSigaaDetailActionFromRow($, $row, formContexts);

            foundItems.set(code, {
                code,
                name,
                department,
                semester: '',
                description: 'Conteúdo programático não disponível na listagem pública do SIGAA.',
                objective: '',
                syllabus: 'Ementa não disponível na listagem pública do SIGAA.',
                bibliography: '',
                prerequeriments: 'NAO_SE_APLICA',
                methodology: '',
                modality: componentType,
                learningAssessment: '',
                academicLevel,
                workload: {
                    theoretical: totalHours,
                    practice: 0,
                    internship: 0,
                },
                detailUrl,
                detailActionUrl: detailAction.detailActionUrl,
                detailActionPayload: detailAction.detailActionPayload,
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
                methodology: data.methodology?.trim() || 'Não há Metodologia cadastrada',
                modality: data.modality?.trim() || 'Não há Modalidade cadastrada',
                learningAssessment: data.learningAssessment?.trim() || 'Não há Avaliação de Aprendizagem cadastrada'
            });
            await this.componentRepository.save(component);

            const normalizeRelationCodes = (rawList?: string[]) => {
                const normalized = (rawList || [])
                    .map((value) => String(value || '').trim().toUpperCase())
                    .filter((value) => !!value && value !== component.code);

                return Array.from(new Set(normalized));
            };

            const coRequisiteCodes = normalizeRelationCodes(data.coRequisites);
            const equivalenceCodes = normalizeRelationCodes(data.equivalences);
            const relationsToPersist = [
                ...coRequisiteCodes.map((relatedCode) => this.componentRelationRepository.create({
                    componentId: component.id,
                    relationType: ComponentRelationType.CO_REQUISITE,
                    relatedCode,
                })),
                ...equivalenceCodes.map((relatedCode) => this.componentRelationRepository.create({
                    componentId: component.id,
                    relationType: ComponentRelationType.EQUIVALENCE,
                    relatedCode,
                })),
            ];

            if (relationsToPersist.length > 0) {
                await this.componentRelationRepository.save(relationsToPersist);
            }

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

    async importComponentsFromSiac(userId: string, cdCurso: string, nuPerCursoInicial: string): Promise<ImportComponentsSummary> {
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
        let requested = 0;
        let created = 0;
        let skippedExisting = 0;
        let failed = 0;
        const failures: string[] = [];

        for (const response of responses) {
            const pageDecoder = new TextDecoder('ISO-8859-1');
            const html = pageDecoder.decode(response.data);
            const $ = cheerio.load(html);
            const courseInfo = extractCourseInfo($);
            requested += courseInfo.length;

            for (const componentData of courseInfo) {
                try {
                    await this.createComponent(userId, componentData);
                    created += 1;
                } catch (err) {
                    const appError = err as AppError;

                    if (appError.message === 'Component already exists.') {
                        skippedExisting += 1;
                        continue;
                    }

                    failed += 1;
                    failures.push(`${componentData.code}: ${appError.message || 'Unexpected error.'}`);
                }
            }
        }

        return {
            source: 'siac',
            requested,
            created,
            skippedExisting,
            failed,
            failures,
        } as ImportComponentsSummary;
    }

    async importComponentsFromSigaaPublic(
        userId: string,
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ): Promise<ImportComponentsSummary> {
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

        componentsInfo = await this.enrichSigaaComponentsFromPublicDetails(componentsInfo, 4);

        let created = 0;
        let skippedExisting = 0;
        let failed = 0;
        const failures: string[] = [];

        for (const componentData of componentsInfo) {
            try {
                await this.createComponent(userId, componentData);
                created += 1;
            } catch (err) {
                const appError = err as AppError;

                if (appError.message === 'Component already exists.') {
                    skippedExisting += 1;
                    continue;
                }

                failed += 1;
                failures.push(`${componentData.code}: ${appError.message || 'Unexpected error.'}`);
            }
        }

        return {
            source: 'sigaa-public',
            requested: componentsInfo.length,
            created,
            skippedExisting,
            failed,
            failures,
        } as ImportComponentsSummary;
    }

}
