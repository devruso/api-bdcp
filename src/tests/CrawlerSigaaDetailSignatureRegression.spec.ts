import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

import { CrawlerService } from '../services/CrawlerService';

type SignatureManifestEntry = {
    cycle: string;
    unit: string;
    code: string;
    htmlFile: string;
    expectedPrerequeriments: string;
};

type SignatureManifest = {
    capturedAt: string;
    requiredUnits: string[];
    minimumPerUnitPerCycle: number;
    entries: SignatureManifestEntry[];
};

describe('CrawlerService SIGAA detail signature regression', () => {
    const service = Object.create(CrawlerService.prototype) as CrawlerService;
    const fixtureDir = path.resolve(__dirname, 'fixtures/sigaa/detail-signatures');
    const manifestPath = path.join(fixtureDir, 'manifest.json');

    it('should keep parser behavior stable across captured signatures by unit', () => {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SignatureManifest;
        const perUnitCount = new Map<string, number>();
        const perCycleUnitCount = new Map<string, number>();

        expect(manifest.entries.length).toBeGreaterThanOrEqual(24);
        expect(new Set(manifest.entries.map((entry) => entry.cycle)).size).toBeGreaterThanOrEqual(2);

        for (const entry of manifest.entries) {
            const htmlPath = path.join(fixtureDir, entry.htmlFile);
            const html = fs.readFileSync(htmlPath, 'utf-8');
            const $ = cheerio.load(html);

            const detail = (service as any).parseSigaaComponentDetailPage($);
            const prereq = String(detail.prerequeriments || '').trim();

            expect(prereq).toBe(entry.expectedPrerequeriments);
            expect(prereq).not.toMatch(/^(co\s*-?\s*requisitos?|correquisitos?|equivalenc(?:ia|ias)|ementa|objetiv(?:o|os)|metodologia|avaliac(?:ao|ao\s+da\s+aprendizagem))\s*:?$/i);

            const current = perUnitCount.get(entry.unit) || 0;
            perUnitCount.set(entry.unit, current + 1);

            const cycleUnitKey = `${entry.cycle}|${entry.unit}`;
            const cycleUnitCurrent = perCycleUnitCount.get(cycleUnitKey) || 0;
            perCycleUnitCount.set(cycleUnitKey, cycleUnitCurrent + 1);
        }

        for (const unit of manifest.requiredUnits) {
            expect(perUnitCount.get(unit)).toBeGreaterThanOrEqual(manifest.minimumPerUnitPerCycle * 2);
        }

        const cycles = Array.from(new Set(manifest.entries.map((entry) => entry.cycle)));
        for (const cycle of cycles) {
            for (const unit of manifest.requiredUnits) {
                const key = `${cycle}|${unit}`;
                expect(perCycleUnitCount.get(key)).toBeGreaterThanOrEqual(manifest.minimumPerUnitPerCycle);
            }
        }
    });
});
