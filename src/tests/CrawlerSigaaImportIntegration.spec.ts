import axios from 'axios';
import { getCustomRepository } from 'typeorm';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';
import { UserRepository } from '../repositories/UserRepository';
import { ComponentRepository } from '../repositories/ComponentRepository';
import { ComponentRelationRepository } from '../repositories/ComponentRelationRepository';
import { UserRole } from '../interfaces/UserRole';
import { ComponentRelationType } from '../interfaces/ComponentRelationType';
import connection from './connection';

jest.mock('axios');

describe('CrawlerService SIGAA import integration', () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeAll(async () => {
    await connection.create();
  });

  afterAll(async () => {
    await connection.close();
  });

    beforeEach(async () => {
      await connection.clear();
        mockedAxios.get.mockReset();
        mockedAxios.post.mockReset();
    });

    it('should fallback to JSF search flow when direct source returns no components', async () => {
        const service = Object.create(CrawlerService.prototype) as CrawlerService;

        (service as any).getSigaaSourceUrls = jest.fn().mockReturnValue([
            'https://sigaa.ufba.br/sigaa/public/programa/curriculo.jsf?lc=pt_BR&id=1820',
        ]);

        const createComponentSpy = jest
            .spyOn(service as any, 'createComponent')
            .mockResolvedValue(undefined);

        const emptyDirectPage = '<html><body><p>Nenhuma turma encontrada</p></body></html>';
        const jsfSearchFormPage = `
            <html>
              <body>
                <form id="form" action="/sigaa/public/componentes/busca_componentes.jsf">
                  <input type="hidden" name="javax.faces.ViewState" value="j_id2" />
                </form>
              </body>
            </html>
        `;
        const jsfSearchResultPage = `
            <html>
              <body>
                <table>
                  <tr>
                    <td>PGCOMP/IC0032</td>
                    <td>BANCO DE DADOS</td>
                    <td>PROGRAMA DE POS-GRADUACAO EM CIENCIA DA COMPUTACAO</td>
                  </tr>
                </table>
              </body>
            </html>
        `;

        mockedAxios.get
            .mockResolvedValueOnce({ data: Buffer.from(emptyDirectPage, 'latin1') } as any)
            .mockResolvedValueOnce({ data: Buffer.from(jsfSearchFormPage, 'latin1') } as any);

        mockedAxios.post.mockResolvedValueOnce({
            data: Buffer.from(jsfSearchResultPage, 'latin1'),
        } as any);

        await service.importComponentsFromSigaaPublic(
            'user-1',
            'program',
            '1820',
            AcademicLevel.MASTERS
        );

        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);

        const [postUrl, postBody] = mockedAxios.post.mock.calls[0];
        expect(postUrl).toContain('/sigaa/public/componentes/busca_componentes.jsf');
        expect(postBody).toContain('form%3Anivel=S');
        expect(postBody).toContain('form%3Atipo=2');
        expect(postBody).toContain('form%3Aunidades=1820');

        expect(createComponentSpy).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                code: 'IC0032',
                name: 'BANCO DE DADOS',
                academicLevel: AcademicLevel.MASTERS,
            })
        );
    });

    it('should persist component relations from SIGAA detail enrichment during import', async () => {
        const service = new CrawlerService();
        const userRepository = getCustomRepository(UserRepository);
        const componentRepository = getCustomRepository(ComponentRepository);
        const componentRelationRepository = getCustomRepository(ComponentRelationRepository);

        const user = await userRepository.save(userRepository.create({
            name: 'Crawler Import Admin',
            email: 'crawler-import-admin@test.com',
            password: '123456',
            role: UserRole.ADMIN,
        }));

        (service as any).getSigaaSourceUrls = jest.fn().mockReturnValue([
            'https://sigaa.ufba.br/sigaa/public/programa/curriculo.jsf?lc=pt_BR&id=1820',
        ]);

        mockedAxios.get.mockResolvedValueOnce({
            data: Buffer.from('<html><body><p>Nenhuma turma encontrada</p></body></html>', 'latin1'),
        } as any);

        jest.spyOn(service as any, 'searchSigaaComponentsByUnit').mockResolvedValue([
            {
                code: 'IC0032',
                name: 'BANCO DE DADOS',
                department: 'PGCOMP',
                semester: '',
                description: 'desc',
                objective: '',
                syllabus: '',
                bibliography: '',
                prerequeriments: 'NAO_SE_APLICA',
                methodology: '',
                modality: 'DISCIPLINA',
                learningAssessment: '',
                academicLevel: AcademicLevel.MASTERS,
                workload: { theoretical: 60, practice: 0, internship: 0 },
                detailActionUrl: 'https://sigaa.ufba.br/sigaa/public/componentes/busca_componentes.jsf',
                detailActionPayload: 'idComponente=45325',
            },
        ]);

        jest.spyOn(service as any, 'enrichSigaaComponentsFromPublicDetails').mockResolvedValue([
            {
                code: 'IC0032',
                name: 'BANCO DE DADOS',
                department: 'PGCOMP',
                semester: '',
                description: 'desc',
                objective: '',
                syllabus: 'Introdução aos sistemas computacionais.',
                bibliography: '',
                prerequeriments: 'MAT001',
                methodology: '',
                modality: 'DISCIPLINA',
                learningAssessment: '',
                academicLevel: AcademicLevel.MASTERS,
                workload: { theoretical: 45, practice: 15, internship: 0 },
                coRequisites: ['FIS001', 'FIS002'],
                equivalences: ['MATX01', 'MATX02'],
            },
        ]);

        const result = await service.importComponentsFromSigaaPublic(
            user.id,
            'program',
            '1820',
            AcademicLevel.MASTERS
        );

        const component = await componentRepository.findOne({ where: { code: 'IC0032' } });
        const relations = await componentRelationRepository.find({ where: { componentId: component?.id } });

        expect(result).toMatchObject({
            requested: 1,
            created: 1,
            skippedExisting: 0,
            failed: 0,
        });
        expect(component).toBeTruthy();
        expect(relations).toHaveLength(4);
        expect(relations).toEqual(expect.arrayContaining([
            expect.objectContaining({ relationType: ComponentRelationType.CO_REQUISITE, relatedCode: 'FIS001' }),
            expect.objectContaining({ relationType: ComponentRelationType.CO_REQUISITE, relatedCode: 'FIS002' }),
            expect.objectContaining({ relationType: ComponentRelationType.EQUIVALENCE, relatedCode: 'MATX01' }),
            expect.objectContaining({ relationType: ComponentRelationType.EQUIVALENCE, relatedCode: 'MATX02' }),
        ]));
    });
});
