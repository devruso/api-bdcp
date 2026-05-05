import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import * as cheerio from 'cheerio';

import { CrawlerService } from '../services/CrawlerService';

type BenchmarkCase = {
    name: 'linear' | 'table' | 'hybrid';
    html: string;
};

type BenchmarkCaseResult = {
    name: string;
    iterations: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
};

type BenchmarkReport = {
    generatedAt: string;
    config: {
        iterations: number;
        warmup: number;
        regressionThresholdPercent: number;
        baselinePath?: string;
    };
    results: BenchmarkCaseResult[];
    regressions: Array<{
        caseName: string;
        baselineAvgMs: number;
        currentAvgMs: number;
        deltaPercent: number;
    }>;
};

const parseArgs = () => {
    const raw = process.argv.slice(2);
    const lookup = new Map<string, string>();

    for (let i = 0; i < raw.length; i += 1) {
        const token = raw[i];
        const next = raw[i + 1];

        if (token.startsWith('--') && next && !next.startsWith('--')) {
            lookup.set(token.slice(2), next);
            i += 1;
        }
    }

    return {
        iterations: Math.max(100, Number(lookup.get('iterations') || 1000)),
        warmup: Math.max(10, Number(lookup.get('warmup') || 100)),
        output: lookup.get('output')
            || path.resolve(__dirname, '..', 'tests', 'fixtures', 'sigaa', 'parser-benchmark.latest.json'),
        baseline: lookup.get('baseline'),
        regressionThresholdPercent: Math.max(1, Number(lookup.get('regression-threshold') || 20)),
    };
};

const loadCaseHtml = (fixtureName: string): string => {
    const fixturePath = path.resolve(__dirname, '..', 'tests', 'fixtures', 'sigaa', fixtureName);
    return fs.readFileSync(fixturePath, 'utf-8');
};

const buildBenchmarkCases = (): BenchmarkCase[] => {
    const tableHtml = `
      <html><body>
        <table>
          <tr><th>Pré-Requisitos</th><td>MAT101; MAT102</td></tr>
          <tr><th>Co-Requisitos</th><td>FIS201/FIS202</td></tr>
          <tr><th>Equivalências</th><td>MATX11, MATX12</td></tr>
          <tr><th>Ementa</th><td>Estruturas e algoritmos avançados.</td></tr>
          <tr><th>Objetivos</th><td>Aprofundar modelagem e desempenho.</td></tr>
          <tr><th>Metodologia</th><td>Aulas expositivas e laboratório guiado.</td></tr>
          <tr><th>Avaliação da Aprendizagem</th><td>Projeto, provas e seminário.</td></tr>
        </table>
        <p>Teórica: 60h</p>
        <p>Prática: 0h</p>
        <p>Estágio: 0h</p>
      </body></html>
    `;

    const hybridHtml = loadCaseHtml('detail-variation-hyphen.html');
    const linearHtml = loadCaseHtml('detail-variation-text-without-codes.html');

    return [
        { name: 'linear', html: linearHtml },
        { name: 'table', html: tableHtml },
        { name: 'hybrid', html: hybridHtml },
    ];
};

const percentile = (values: number[], target: number): number => {
    if (!values.length) {
        return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((target / 100) * sorted.length) - 1));
    return sorted[index];
};

const benchmarkCase = (
    service: CrawlerService,
    benchmarkCaseData: BenchmarkCase,
    iterations: number,
    warmup: number
): BenchmarkCaseResult => {
    const parseDetail = (service as any).parseSigaaComponentDetailPage.bind(service);

    for (let i = 0; i < warmup; i += 1) {
        const $ = cheerio.load(benchmarkCaseData.html);
        parseDetail($);
    }

    const durations: number[] = [];

    for (let i = 0; i < iterations; i += 1) {
        const start = performance.now();
        const $ = cheerio.load(benchmarkCaseData.html);
        parseDetail($);
        durations.push(performance.now() - start);
    }

    const total = durations.reduce((acc, current) => acc + current, 0);

    return {
        name: benchmarkCaseData.name,
        iterations,
        avgMs: Number((total / durations.length).toFixed(6)),
        minMs: Number(Math.min(...durations).toFixed(6)),
        maxMs: Number(Math.max(...durations).toFixed(6)),
        p95Ms: Number(percentile(durations, 95).toFixed(6)),
    };
};

const compareWithBaseline = (
    currentResults: BenchmarkCaseResult[],
    baselinePath: string,
    thresholdPercent: number
) => {
    if (!fs.existsSync(baselinePath)) {
        return [] as BenchmarkReport['regressions'];
    }

    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as BenchmarkReport;
    const baselineIndex = new Map(baseline.results.map((entry) => [entry.name, entry]));

    return currentResults
        .map((entry) => {
            const baselineEntry = baselineIndex.get(entry.name);

            if (!baselineEntry || baselineEntry.avgMs <= 0) {
                return null;
            }

            const deltaPercent = Number((((entry.avgMs - baselineEntry.avgMs) / baselineEntry.avgMs) * 100).toFixed(2));

            if (deltaPercent <= thresholdPercent) {
                return null;
            }

            return {
                caseName: entry.name,
                baselineAvgMs: baselineEntry.avgMs,
                currentAvgMs: entry.avgMs,
                deltaPercent,
            };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);
};

const main = () => {
    const config = parseArgs();
    const service = Object.create(CrawlerService.prototype) as CrawlerService;
    const cases = buildBenchmarkCases();

    const results = cases.map((currentCase) => benchmarkCase(service, currentCase, config.iterations, config.warmup));
    const regressions = config.baseline
        ? compareWithBaseline(results, path.resolve(config.baseline), config.regressionThresholdPercent)
        : [];

    const report: BenchmarkReport = {
        generatedAt: new Date().toISOString(),
        config: {
            iterations: config.iterations,
            warmup: config.warmup,
            regressionThresholdPercent: config.regressionThresholdPercent,
            baselinePath: config.baseline,
        },
        results,
        regressions,
    };

    const outputPath = path.resolve(config.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

    console.log(JSON.stringify(report, null, 2));

    if (regressions.length > 0) {
        process.exitCode = 1;
    }
};

main();
