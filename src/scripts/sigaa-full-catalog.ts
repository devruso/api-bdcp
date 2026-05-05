import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';

type SigaaNivel = 'G' | 'S';
type UnitCategory = 'department' | 'program' | 'institute' | 'other';
type AcademicBucket = 'graduacao' | 'mestrado' | 'doutorado' | 'stricto_indefinido';

type UnitEntry = {
    id: string;
    label: string;
    nivel: SigaaNivel;
    category: UnitCategory;
    bucket: AcademicBucket;
    departmentName: string;
    instituteCode: string;
};

type UnitScanResult = UnitEntry & {
    sourceType: 'department' | 'program';
    requestedAcademicLevel: AcademicLevel;
    componentCount: number;
    sampleCodes: string[];
    richCoverage?: {
        withDetailUrl: number;
        withDetailAction: number;
        withDetailEndpoint: number;
        withPrerequeriments: number;
        withCoRequisites: number;
        withEquivalences: number;
        withSyllabus: number;
        withWorkloadBreakdown: number;
    };
    error?: string;
};

const SEARCH_URL = 'https://sigaa.ufba.br/sigaa/public/componentes/busca_componentes.jsf';
const decoder = new TextDecoder('ISO-8859-1');

const normalizeText = (value?: string) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim();

const parseArgs = () => {
    const args = process.argv.slice(2);
    const lookup = new Map<string, string>();

    for (let i = 0; i < args.length; i += 1) {
        const token = args[i];

        if (!token.startsWith('--')) {
            continue;
        }

        const key = token.replace(/^--/, '');
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';

        lookup.set(key, value);
    }

    return {
        limit: Number(lookup.get('limit') || 0),
        concurrency: Math.max(1, Number(lookup.get('concurrency') || 4)),
        enrichDetails: /^(true|1|yes)$/i.test(String(lookup.get('enrich-details') || 'false')),
        detailsConcurrency: Math.max(1, Number(lookup.get('details-concurrency') || 4)),
        output: lookup.get('output') || path.resolve(__dirname, '..', 'tests', 'fixtures', 'sigaa', 'full-catalog-results.json'),
    };
};

const inferCategory = (label: string): UnitCategory => {
    const normalized = label.toUpperCase();

    if (/\bPROGRAMA\b|\bPOS-GRADUACAO\b|\bP[OÓ]S-GRADUA[ÇC][AÃ]O\b/.test(normalized)) {
        return 'program';
    }

    if (/\bDEPARTAMENTO\b/.test(normalized)) {
        return 'department';
    }

    if (/\bINSTITUTO\b/.test(normalized)) {
        return 'institute';
    }

    return 'other';
};

const inferAcademicBucket = (label: string, nivel: SigaaNivel): AcademicBucket => {
    if (nivel === 'G') {
        return 'graduacao';
    }

    const normalized = label.toUpperCase();
    const hasMasters = /\bMESTRADO\b/.test(normalized);
    const hasDoctorate = /\bDOUTORADO\b/.test(normalized);

    if (hasDoctorate && !hasMasters) {
        return 'doutorado';
    }

    if (hasMasters) {
        return 'mestrado';
    }

    return 'stricto_indefinido';
};

const inferDepartmentName = (label: string): string => {
    const normalized = normalizeText(label);

    if (!normalized) {
        return 'N/A';
    }

    const beforeSlash = normalized.split('/')[0] || normalized;
    const beforeDash = beforeSlash.split(' - ')[0] || beforeSlash;

    return normalizeText(beforeDash);
};

const inferInstituteCode = (label: string): string => {
    const normalized = normalizeText(label);
    const slashMatch = normalized.match(/\/\s*([A-Z]{2,10})\s*-?/i);

    if (slashMatch?.[1]) {
        return slashMatch[1].toUpperCase();
    }

    if (/\bINSTITUTO DE COMPUTACAO\b|\bINSTITUTO DE COMPUTAÇÃO\b/i.test(normalized)) {
        return 'IC';
    }

    return 'N/A';
};

const mapBucketToAcademicLevel = (bucket: AcademicBucket): AcademicLevel => {
    if (bucket === 'graduacao') {
        return AcademicLevel.GRADUATION;
    }

    if (bucket === 'doutorado') {
        return AcademicLevel.DOCTORATE;
    }

    return AcademicLevel.MASTERS;
};

const collectUnitsFromNivel = async (nivel: SigaaNivel): Promise<UnitEntry[]> => {
    const response = await axios.get<ArrayBuffer>(`${SEARCH_URL}?nivel=${nivel}`, {
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
    });

    const html = decoder.decode(response.data);
    const $ = cheerio.load(html);

    const select = $('select[name$=":unidades"]').first();

    if (!select.length) {
        throw new Error(`Nao foi possivel localizar select de unidades para nivel ${nivel}.`);
    }

    const map = new Map<string, UnitEntry>();

    select.find('option').each((_, option) => {
        const $option = $(option);
        const id = normalizeText($option.attr('value'));
        const label = normalizeText($option.text());

        if (!id || !/^\d+$/.test(id) || id === '0' || !label) {
            return;
        }

        if (map.has(id)) {
            return;
        }

        map.set(id, {
            id,
            label,
            nivel,
            category: inferCategory(label),
            bucket: inferAcademicBucket(label, nivel),
            departmentName: inferDepartmentName(label),
            instituteCode: inferInstituteCode(label),
        });
    });

    return Array.from(map.values());
};

const runWithConcurrency = async <T, R>(
    values: T[],
    concurrency: number,
    worker: (value: T) => Promise<R>
): Promise<R[]> => {
    const results: R[] = [];
    let cursor = 0;

    const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
        while (cursor < values.length) {
            const currentIndex = cursor;
            cursor += 1;
            results[currentIndex] = await worker(values[currentIndex]);
        }
    });

    await Promise.all(runners);

    return results;
};

const groupCounts = <T extends string>(items: string[], allowedKeys: T[]) => {
    const grouped = allowedKeys.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {} as Record<T, number>);

    for (const item of items) {
        if (Object.prototype.hasOwnProperty.call(grouped, item)) {
            grouped[item as T] += 1;
        }
    }

    return grouped;
};

const hasDetailEndpoint = (component: any) =>
    !!component?.detailUrl || (!!component?.detailActionUrl && !!component?.detailActionPayload);

const mergeSigaaDetailsByCode = (baseComponents: Array<any>, detailComponents: Array<any>) => {
    const detailMap = new Map<string, any>();

    detailComponents.forEach((component) => {
        if (component?.code) {
            detailMap.set(component.code, component);
        }
    });

    return baseComponents.map((component) => {
        const detail = detailMap.get(component.code);

        if (!detail) {
            return component;
        }

        if (hasDetailEndpoint(component)) {
            return component;
        }

        return {
            ...component,
            detailUrl: detail.detailUrl,
            detailActionUrl: detail.detailActionUrl,
            detailActionPayload: detail.detailActionPayload,
        };
    });
};

const main = async () => {
    const args = parseArgs();
    const service = Object.create(CrawlerService.prototype) as CrawlerService;
    const getSourceUrls = (service as any).getSigaaSourceUrls.bind(service) as (
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ) => string[];
    const extractRows = (service as any).extractSigaaListRows.bind(service) as (
        $: cheerio.CheerioAPI,
        sourceType: 'department' | 'program',
        academicLevel: AcademicLevel
    ) => Array<{ code: string }>;
    const searchByUnit = (service as any).searchSigaaComponentsByUnit.bind(service) as (
        sourceType: 'department' | 'program',
        sourceId: string,
        academicLevel: AcademicLevel
    ) => Promise<Array<any>>;
    const enrichDetails = (service as any).enrichSigaaComponentsFromPublicDetails.bind(service) as (
        components: Array<any>,
        concurrency?: number
    ) => Promise<Array<any>>;

    const [graduationUnits, strictoUnits] = await Promise.all([
        collectUnitsFromNivel('G'),
        collectUnitsFromNivel('S'),
    ]);

    let units = [...graduationUnits, ...strictoUnits];

    if (args.limit > 0) {
        units = units.slice(0, args.limit);
    }

    const results = await runWithConcurrency(units, args.concurrency, async (unit): Promise<UnitScanResult> => {
        const sourceType: 'department' | 'program' = unit.category === 'program' ? 'program' : 'department';
        const requestedAcademicLevel = mapBucketToAcademicLevel(unit.bucket);

        try {
            const urls = getSourceUrls(sourceType, unit.id, requestedAcademicLevel);
            let components: Array<any> = [];

            for (const url of urls) {
                try {
                    const response = await axios.get<ArrayBuffer>(url, {
                        responseType: 'arraybuffer',
                        responseEncoding: 'binary',
                    });
                    const html = decoder.decode(response.data);
                    const $ = cheerio.load(html);
                    components = extractRows($, sourceType, requestedAcademicLevel);

                    if (components.length > 0) {
                        break;
                    }
                } catch {
                    // Ignore this source and continue to fallback.
                }
            }

            if (components.length === 0) {
                components = await searchByUnit(sourceType, unit.id, requestedAcademicLevel);
            } else if (args.enrichDetails) {
                const missingDetailCount = components.filter((component) => !hasDetailEndpoint(component)).length;

                if (missingDetailCount > 0) {
                    const searchComponents = await searchByUnit(sourceType, unit.id, requestedAcademicLevel);

                    if (searchComponents.length > 0) {
                        components = mergeSigaaDetailsByCode(components, searchComponents);
                    }
                }
            }

            if (args.enrichDetails && components.length > 0) {
                components = await enrichDetails(components, args.detailsConcurrency);
            }

            return {
                ...unit,
                sourceType,
                requestedAcademicLevel,
                componentCount: components.length,
                sampleCodes: components.slice(0, 10).map((component) => component.code),
                ...(args.enrichDetails
                    ? {
                        richCoverage: {
                            withDetailUrl: components.filter((component) => !!component.detailUrl).length,
                            withDetailAction: components.filter((component) => !!component.detailActionUrl && !!component.detailActionPayload).length,
                            withDetailEndpoint: components.filter((component) => !!component.detailUrl || (!!component.detailActionUrl && !!component.detailActionPayload)).length,
                            withPrerequeriments: components.filter((component) => component.prerequeriments && component.prerequeriments !== 'NAO_SE_APLICA').length,
                            withCoRequisites: components.filter((component) => Array.isArray(component.coRequisites) && component.coRequisites.length > 0).length,
                            withEquivalences: components.filter((component) => Array.isArray(component.equivalences) && component.equivalences.length > 0).length,
                            withSyllabus: components.filter((component) => !!component.syllabus && !/não disponível na listagem pública/i.test(component.syllabus)).length,
                            withWorkloadBreakdown: components.filter((component) => {
                                const workload = component.workload || {};
                                return Number(workload.theoretical || 0) > 0 || Number(workload.practice || 0) > 0 || Number(workload.internship || 0) > 0 || Number(component.workloadExtension || 0) > 0;
                            }).length,
                        },
                    }
                    : {}),
            };
        } catch (err) {
            return {
                ...unit,
                sourceType,
                requestedAcademicLevel,
                componentCount: 0,
                sampleCodes: [],
                error: (err as Error).message,
            };
        }
    });

    const successResults = results.filter((result) => !result.error);
    const failedResults = results.filter((result) => !!result.error);

    const byAcademicBucket = groupCounts(
        successResults.map((result) => result.bucket),
        ['graduacao', 'mestrado', 'doutorado', 'stricto_indefinido']
    );

    const byCategory = groupCounts(
        successResults.map((result) => result.category),
        ['department', 'program', 'institute', 'other']
    );

    const byInstitute: Record<string, {
        units: number;
        components: number;
        departments: string[];
    }> = {};

    for (const result of successResults) {
        const instituteKey = result.instituteCode || 'N/A';

        if (!byInstitute[instituteKey]) {
            byInstitute[instituteKey] = {
                units: 0,
                components: 0,
                departments: [],
            };
        }

        byInstitute[instituteKey].units += 1;
        byInstitute[instituteKey].components += result.componentCount;

        if (result.departmentName && !byInstitute[instituteKey].departments.includes(result.departmentName)) {
            byInstitute[instituteKey].departments.push(result.departmentName);
        }
    }

    Object.values(byInstitute).forEach((entry) => {
        entry.departments.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    });

    const report = {
        generatedAt: new Date().toISOString(),
        execution: {
            totalUnitsScanned: results.length,
            successfulUnits: successResults.length,
            failedUnits: failedResults.length,
            totalComponentsExtracted: successResults.reduce((sum, result) => sum + result.componentCount, 0),
            concurrency: args.concurrency,
            limit: args.limit,
            enrichDetails: args.enrichDetails,
            detailsConcurrency: args.detailsConcurrency,
        },
        grouped: {
            byAcademicBucket,
            byCategory,
            byInstitute,
        },
        units: results,
        failures: failedResults.map((result) => ({
            id: result.id,
            label: result.label,
            sourceType: result.sourceType,
            bucket: result.bucket,
            error: result.error,
        })),
        instituteDepartmentModel: Object.entries(byInstitute).map(([instituteCode, entry]) => ({
            instituteCode,
            departments: entry.departments,
            unitCount: entry.units,
            componentCount: entry.components,
        })),
    };

    fs.writeFileSync(args.output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
        output: args.output,
        scanned: report.execution.totalUnitsScanned,
        successful: report.execution.successfulUnits,
        failed: report.execution.failedUnits,
        extractedComponents: report.execution.totalComponentsExtracted,
    }, null, 2));
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
