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
});
