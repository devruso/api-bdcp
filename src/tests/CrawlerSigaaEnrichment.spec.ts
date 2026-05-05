import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';
import { IComponentInfoCrawler } from '../interfaces/IComponentInfoCrawler';

describe('CrawlerService SIGAA enrichment throughput', () => {
    it('should deduplicate in-flight detail fetches by component identifier', async () => {
        const service = Object.create(CrawlerService.prototype) as CrawlerService;
        const fetchSpy = jest
            .spyOn(service as any, 'fetchSigaaComponentDetail')
            .mockImplementation(async () => ({
                prerequeriments: 'MAT001',
                coRequisites: ['FIS001'],
                equivalences: ['MATA10'],
                syllabus: 'Conteudo de teste',
                workload: {
                    theoretical: 60,
                    practice: 0,
                    internship: 0,
                    extension: 0,
                },
            }));

        const baseComponent: IComponentInfoCrawler = {
            code: 'MAT999',
            name: 'Disciplina Teste',
            department: 'DCC',
            semester: '',
            description: '',
            objective: '',
            syllabus: '',
            bibliography: '',
            prerequeriments: 'NAO_SE_APLICA',
            methodology: '',
            modality: 'DISCIPLINA',
            learningAssessment: '',
            academicLevel: AcademicLevel.GRADUATION,
            workload: {
                theoretical: 60,
                practice: 0,
                internship: 0,
            },
            detailActionUrl: 'https://sigaa.ufba.br/sigaa/public/componentes/busca_componentes.jsf',
            detailActionPayload:
                'javax.faces.ViewState=j_id1&idComponente=45325&formListagemComponentes=formListagemComponentes',
        };

        const components: IComponentInfoCrawler[] = [
            { ...baseComponent, code: 'MAT999A' },
            { ...baseComponent, code: 'MAT999B' },
            { ...baseComponent, code: 'MAT999C' },
        ];

        const result = await service.enrichSigaaComponentsFromPublicDetails(components, 3);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(result.every((component) => component.syllabus === 'Conteudo de teste')).toBe(true);
        expect(result.every((component) => component.prerequeriments === 'MAT001')).toBe(true);
    });
});
