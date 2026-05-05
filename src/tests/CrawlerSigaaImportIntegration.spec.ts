import axios from 'axios';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';

jest.mock('axios');

describe('CrawlerService SIGAA import integration', () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;

    beforeEach(() => {
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
});
