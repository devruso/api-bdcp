import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

import { CrawlerService } from '../services/CrawlerService';
import { AcademicLevel } from '../interfaces/AcademicLevel';

describe('CrawlerService SIGAA parser', () => {
    const service = Object.create(CrawlerService.prototype) as CrawlerService;

    it('should ignore JS/CSS token noise when SIGAA page has no components', () => {
        const fixturePath = path.resolve(__dirname, 'fixtures/sigaa/source-department-1876851.html');
        const html = fs.readFileSync(fixturePath, 'utf-8');
        const $ = cheerio.load(html);

        const result = (service as any).extractSigaaListRows($, 'department', AcademicLevel.GRADUATION);

        expect(result).toEqual([]);
    });

    it('should extract component rows from tabular SIGAA-like HTML', () => {
        const html = `
            <table>
              <tr class="linhaPar">
                <td>MATA01</td>
                <td>Calculo I</td>
                <td>Departamento de Ciencia da Computacao</td>
              </tr>
              <tr class="linhaImpar">
                <td>MATB02</td>
                <td>Algoritmos</td>
                <td>DCC</td>
              </tr>
              <tr class="linhaPar">
                <td>MATA01</td>
                <td>Calculo I (duplicada)</td>
                <td>DCC</td>
              </tr>
            </table>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).extractSigaaListRows($, 'department', AcademicLevel.GRADUATION);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(
            expect.objectContaining({
                code: 'MATA01',
                name: 'Calculo I',
                department: 'Departamento de Ciencia da Computacao',
                academicLevel: AcademicLevel.GRADUATION,
            })
        );
        expect(result[1]).toEqual(
            expect.objectContaining({
                code: 'MATB02',
                name: 'Algoritmos',
            })
        );
    });

      it('should extract code when SIGAA row has program prefix', () => {
        const html = `
          <table>
            <tr class="linhaPar">
            <td>PGCOMP/IC0032</td>
            <td>Banco de Dados</td>
            <td>DISCIPLINA</td>
            </tr>
          </table>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).extractSigaaListRows($, 'program', AcademicLevel.MASTERS);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          expect.objectContaining({
            code: 'IC0032',
            name: 'Banco de Dados',
            academicLevel: AcademicLevel.MASTERS,
          })
        );
      });

    it('should extract workload hours and component type from SIGAA listing row', () => {
        const html = `
          <table>
            <tr class="linhaPar">
              <td>MAT154</td>
              <td>SISTEMAS OPERACIONAIS</td>
              <td>DISCIPLINA</td>
              <td>60h</td>
            </tr>
          </table>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).extractSigaaListRows($, 'department', AcademicLevel.GRADUATION);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
            expect.objectContaining({
                code: 'MAT154',
                name: 'SISTEMAS OPERACIONAIS',
                modality: 'DISCIPLINA',
                workload: {
                    theoretical: 60,
                    practice: 0,
                    internship: 0,
                },
            })
        );
    });

    it('should not treat busca form rows as curricular components', () => {
        const html = `
          <table>
            <tr>
              <td>Código do Componente:</td>
              <td>(Ex. MAT0311)</td>
            </tr>
            <tr>
              <td>Unidade Responsável:</td>
              <td>COLEGIADO XYZ</td>
            </tr>
          </table>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).extractSigaaListRows($, 'department', AcademicLevel.GRADUATION);

        expect(result).toEqual([]);
    });

    it('should parse details from component page text into structured fields', () => {
        const html = `
          <html>
            <body>
              <div>Pré-Requisitos: MAT001</div>
              <div>Co-Requisitos: FIS001; FIS002</div>
              <div>Equivalências: MATX01, MATX02</div>
              <div>Ementa: Introdução aos sistemas computacionais.</div>
              <div>Objetivos: Compreender arquitetura e processos.</div>
              <div>Metodologia: Aulas expositivas e laboratório.</div>
              <div>Avaliação: Provas e projeto final.</div>
              <div>Teórica: 45h</div>
              <div>Prática: 15h</div>
              <div>Estágio: 0h</div>
              <div>Extensão: 10h</div>
            </body>
          </html>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).parseSigaaComponentDetailPage($);

        expect(result).toEqual(
            expect.objectContaining({
                prerequeriments: 'MAT001',
                coRequisites: ['FIS001', 'FIS002'],
                equivalences: ['MATX01', 'MATX02'],
                syllabus: 'Introdução aos sistemas computacionais.',
                objective: 'Compreender arquitetura e processos.',
                methodology: 'Aulas expositivas e laboratório.',
                learningAssessment: 'Provas e projeto final.',
                workload: {
                    theoretical: 45,
                    practice: 15,
                    internship: 0,
                    extension: 10,
                },
            })
        );
    });

    it('should extract JSF detail action payload from listing row onclick', () => {
        const html = `
          <html>
            <body>
              <form id="formListagemComponentes" action="/sigaa/public/componentes/busca_componentes.jsf">
                <input type="hidden" name="javax.faces.ViewState" value="j_id1" />
              </form>
              <table>
                <tr class="linhaPar">
                  <td>MAT154</td>
                  <td>SISTEMAS OPERACIONAIS</td>
                  <td>DISCIPLINA</td>
                  <td>60h</td>
                  <td>
                    <a href="#" onclick="if(typeof jsfcljs == 'function'){jsfcljs(document.getElementById('formListagemComponentes'),{'formListagemComponentes:j_id_jsp_109_27':'formListagemComponentes:j_id_jsp_109_27','idComponente':'45325'},'');}return false">Visualizar programa</a>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `;

        const $ = cheerio.load(html);
        const result = (service as any).extractSigaaListRows($, 'department', AcademicLevel.GRADUATION);

        expect(result).toHaveLength(1);
        expect(result[0].detailActionUrl).toContain('/sigaa/public/componentes/busca_componentes.jsf');
        expect(result[0].detailActionPayload).toContain('idComponente=45325');
        expect(result[0].detailActionPayload).toContain('javax.faces.ViewState=j_id1');
    });
});
