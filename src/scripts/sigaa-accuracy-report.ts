import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';

type SourceType = 'department' | 'program';

type GroundTruthFile = {
    sources: Record<string, {
        fixturePath: string;
        sourceType: SourceType;
        academicLevel: AcademicLevel;
        expectedDepartment: string;
    }>;
    samples: Array<{
        sourceKey: string;
        expectedCode: string;
        expectedName: string;
    }>;
};

const normalizeText = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const repoRoot = path.resolve(__dirname, '..', '..');
const truthPath = path.resolve(repoRoot, 'src/tests/fixtures/sigaa/manual-ground-truth-stratified.json');
const outputPath = path.resolve(repoRoot, 'src/tests/fixtures/sigaa/accuracy-results.json');

const truth = JSON.parse(fs.readFileSync(truthPath, 'utf-8')) as GroundTruthFile;
const service = Object.create(CrawlerService.prototype) as CrawlerService;

const extractedBySource: Record<string, Map<string, {
    code: string;
    name: string;
    department: string;
    academicLevel?: AcademicLevel;
}>> = {};

const extractionSummary: Array<{
    sourceKey: string;
    sourceType: SourceType;
    academicLevel: AcademicLevel;
    extractedCount: number;
}> = [];

for (const [sourceKey, sourceConfig] of Object.entries(truth.sources)) {
    const fixturePath = path.resolve(repoRoot, sourceConfig.fixturePath);
    const html = fs.readFileSync(fixturePath, 'utf-8');
    const $ = cheerio.load(html);

    const extracted = (service as any).extractSigaaListRows(
        $,
        sourceConfig.sourceType,
        sourceConfig.academicLevel
    ) as Array<{
        code: string;
        name: string;
        department: string;
        academicLevel?: AcademicLevel;
    }>;

    const map = new Map<string, {
        code: string;
        name: string;
        department: string;
        academicLevel?: AcademicLevel;
    }>();

    for (const item of extracted) {
        map.set(normalizeText(item.code), item);
    }

    extractedBySource[sourceKey] = map;
    extractionSummary.push({
        sourceKey,
        sourceType: sourceConfig.sourceType,
        academicLevel: sourceConfig.academicLevel,
        extractedCount: extracted.length,
    });
}

let totalSamples = 0;
let codeCorrect = 0;
let nameCorrect = 0;
let departmentCorrect = 0;
let academicLevelCorrect = 0;

const perSampleResults = truth.samples.map((sample) => {
    totalSamples += 1;

    const sourceConfig = truth.sources[sample.sourceKey];
    const sourceExtracted = extractedBySource[sample.sourceKey];

    const predicted = sourceExtracted.get(normalizeText(sample.expectedCode));

    const codeOk = Boolean(predicted);
    const nameOk = Boolean(predicted && normalizeText(predicted.name) === normalizeText(sample.expectedName));
    const departmentOk = Boolean(
        predicted && normalizeText(predicted.department) === normalizeText(sourceConfig.expectedDepartment)
    );
    const levelOk = Boolean(
        predicted && predicted.academicLevel === sourceConfig.academicLevel
    );

    if (codeOk) {
        codeCorrect += 1;
    }
    if (nameOk) {
        nameCorrect += 1;
    }
    if (departmentOk) {
        departmentCorrect += 1;
    }
    if (levelOk) {
        academicLevelCorrect += 1;
    }

    return {
        ...sample,
        predictedCode: predicted?.code ?? null,
        predictedName: predicted?.name ?? null,
        predictedDepartment: predicted?.department ?? null,
        predictedAcademicLevel: predicted?.academicLevel ?? null,
        checks: {
            codeOk,
            nameOk,
            departmentOk,
            academicLevelOk: levelOk,
        },
    };
});

const ratio = (correct: number) => Number(((correct / totalSamples) * 100).toFixed(2));

const report = {
    generatedAt: new Date().toISOString(),
    totals: {
        samples: totalSamples,
        extractedBySource: extractionSummary,
    },
    accuracyByField: {
        code: { correct: codeCorrect, total: totalSamples, percent: ratio(codeCorrect) },
        name: { correct: nameCorrect, total: totalSamples, percent: ratio(nameCorrect) },
        department: { correct: departmentCorrect, total: totalSamples, percent: ratio(departmentCorrect) },
        academicLevel: { correct: academicLevelCorrect, total: totalSamples, percent: ratio(academicLevelCorrect) },
    },
    perSampleResults,
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
