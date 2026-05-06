import {
    composeBibliographySections,
    formatAbntReferenceBlock,
    hasNonWebReferenceWithoutYear,
    splitBibliographySections,
} from '../helpers/referenceSections';
import { generateHtml } from '../helpers/templates/component';
import { ComponentStatus } from '../interfaces/ComponentStatus';

describe('Reference sections helpers', () => {
    it('should split bibliography text into basic and complementary sections', () => {
        const bibliography = [
            'REFERENCIAS BASICAS:\nLivro A\nLivro B',
            'REFERENCIAS COMPLEMENTARES:\nLivro C',
        ].join('\n\n');

        const sections = splitBibliographySections(bibliography);

        expect(sections.basic).toContain('Livro A');
        expect(sections.basic).toContain('Livro B');
        expect(sections.complementary).toContain('Livro C');
    });

    it('should compose bibliography payload preserving both sections', () => {
        const payload = composeBibliographySections('Livro Base', 'Livro Extra');

        expect(payload).toContain('REFERENCIAS BASICAS');
        expect(payload).toContain('Livro Base');
        expect(payload).toContain('REFERENCIAS COMPLEMENTARES');
        expect(payload).toContain('Livro Extra');
    });

    it('should include access date and time when formatting web references', () => {
        const formatted = formatAbntReferenceBlock('Portal CAPES https://www-periodicos-capes-gov-br.ezl.periodicos.capes.gov.br');

        expect(formatted).toContain('Disponivel em: https://www-periodicos-capes-gov-br.ezl.periodicos.capes.gov.br');
        expect(formatted).toContain('Acesso em:');
        expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
    });

    it('should flag non-web references without publication year', () => {
        expect(hasNonWebReferenceWithoutYear('SILVA, Joao. Compiladores modernos.')).toBe(true);
        expect(hasNonWebReferenceWithoutYear('SILVA, Joao. Compiladores modernos. 2021.')).toBe(false);
    });
});

describe('Template references rendering', () => {
    it('should render basic and complementary references from structured fields', () => {
        const html = generateHtml({
            id: 'component-1',
            userId: 'user-1',
            status: ComponentStatus.PUBLISHED,
            code: 'IC045',
            name: 'Compiladores',
            department: 'DCC',
            modality: 'Presencial',
            program: 'Programa',
            semester: '2026.1',
            prerequeriments: 'MATA50',
            methodology: 'Metodologia',
            objective: 'Objetivo',
            syllabus: 'Ementa',
            learningAssessment: 'Avaliacao',
            bibliography: '',
            referencesBasic: 'Livro Basico',
            referencesComplementary: 'Livro Complementar',
        });

        expect(html).toContain('Referencias basicas');
        expect(html).toContain('Livro Basico');
        expect(html).toContain('Referencias complementares');
        expect(html).toContain('Livro Complementar');
    });
});
