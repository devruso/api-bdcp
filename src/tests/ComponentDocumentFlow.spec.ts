import path from 'path';
import supertest from 'supertest';
const AdmZip = require('adm-zip');
import { UserController } from '../controllers/UserController';
import { UserInviteService } from '../services/UserInviteService';
import connection from './connection';

/* eslint-disable */
const app = require('../app').app;
const MockExpressRequest = require('mock-express-request');
const MockExpressResponse = require('mock-express-response');
/* eslint-enable */

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

jest.setTimeout(30000);

const binaryParser = (res: NodeJS.ReadableStream, callback: (err: Error | null, data: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const createUserAndLogin = async () => {
    const inviteToken = new UserInviteService().generateUserInvite();
    const userController = new UserController();
    const req = new MockExpressRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        params: { inviteToken },
        body: {
            name: 'Test User',
            email: 'test@gmail.com',
            password: 'test123',
        },
    });
    const res = new MockExpressResponse();

    await userController.create(req, res);

    const loginResponse = await supertest(app)
        .post('/api/auth/login')
        .send({ email: 'test@gmail.com', password: 'test123' });

    return loginResponse.body.token as string;
};

describe('Component document flow', () => {
    let token = '';

    beforeAll(async () => {
        await connection.create();
    });

    afterAll(async () => {
        await connection.close();
    });

    beforeEach(async () => {
        token = await createUserAndLogin();
        await supertest(app)
            .put('/api/users/update/signature')
            .set('Authorization', `Bearer ${token}`)
            .send({ signature: 'Assina123!' });
    });

    afterEach(async () => {
        await connection.clear();
    });

    it('should not be able to preview a draft import without file', async () => {
        const response = await supertest(app)
            .post('/api/component-drafts/import-preview')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Nenhum arquivo foi enviado para importação.');
    });

    it('should not be able to preview a draft import with unsupported file type', async () => {
        const response = await supertest(app)
            .post('/api/component-drafts/import-preview')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from('invalid'), {
                filename: 'invalid.txt',
                contentType: 'text/plain',
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('Formato de arquivo nao suportado. Envie um PDF ou DOCX.');
    });

    it('should not be able to preview a draft import above file size limit', async () => {
        const response = await supertest(app)
            .post('/api/component-drafts/import-preview')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.alloc(MAX_FILE_SIZE + 1, 'a'), {
                filename: 'too-large.docx',
                contentType: DOCX_MIME_TYPE,
            });

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe('O arquivo excede o limite de 10MB para importacao.');
    });

    it('should be able to preview a draft import from docx', async () => {
        const fixturePath = path.resolve(__dirname, '../..', 'UFBA_TEMPLATE.docx');

        const response = await supertest(app)
            .post('/api/component-drafts/import-preview')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', fixturePath, {
                contentType: DOCX_MIME_TYPE,
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.fileName).toBe('UFBA_TEMPLATE.docx');
        expect(response.body.mimeType).toBe(DOCX_MIME_TYPE);
        expect(response.body.suggestedDraft.code).toBe('IC045');
        expect(response.body.suggestedDraft.name).toContain('Tópicos');
        expect(response.body.rawText).toContain('PLANO DE ENSINO-APRENDIZAGEM');
        expect(Array.isArray(response.body.warnings)).toBe(true);
    });

    it('should not be able to get component details by code without authentication', async () => {
        const createResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'PUB123',
                name: 'Disciplina Publica',
                department: 'Departamento Publico',
                program: 'Programa Publico',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Disponibilizar acesso publico ao detalhe',
                syllabus: 'Ementa publica',
                bibliography: 'Bibliografia publica',
                modality: 'Presencial',
                learningAssessment: 'Provas',
            });

        expect(createResponse.statusCode).toBe(201);

        const componentResponse = await supertest(app)
            .get('/api/components/PUB123');

        expect(componentResponse.statusCode).toBe(401);
    });

    it('should be able to search published disciplines without accent marks', async () => {
        const createResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'ACC101',
                name: 'Metodologia e Expressão Técnica',
                department: 'Departamento de Testes',
                program: 'Programa de Teste',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Validar busca sem acento',
                syllabus: 'Ementa de teste',
                bibliography: 'Bibliografia de teste',
                modality: 'Presencial',
                learningAssessment: 'Provas',
            });

        expect(createResponse.statusCode).toBe(201);

        const searchResponse = await supertest(app)
            .get('/api/components')
            .set('Authorization', `Bearer ${token}`)
            .query({ search: 'expressao' });

        expect(searchResponse.statusCode).toBe(200);
        expect(searchResponse.body.results.some((component: { code: string }) => component.code === 'ACC101'))
            .toBe(true);
    });

    it('should return the exact published component by code even when there are similar codes', async () => {
        const similarComponentResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'IIC045',
                name: 'Disciplina Publicada Similar',
                department: 'Departamento Similar',
                program: 'Programa Similar',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Validar busca exata em componente publicado',
                syllabus: 'Ementa Similar',
                bibliography: 'Bibliografia Similar',
                modality: 'Presencial',
                learningAssessment: 'Provas',
            });

        expect(similarComponentResponse.statusCode).toBe(201);

        const targetComponentResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'IC045',
                name: 'Disciplina Publicada Alvo',
                department: 'Departamento Alvo',
                program: 'Programa Alvo',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Validar busca exata em componente publicado',
                syllabus: 'Ementa Alvo',
                bibliography: 'Bibliografia Alvo',
                modality: 'Presencial',
                learningAssessment: 'Provas',
            });

        expect(targetComponentResponse.statusCode).toBe(201);

        const getByCodeResponse = await supertest(app)
            .get('/api/components/ic045')
            .set('Authorization', `Bearer ${token}`);

        expect(getByCodeResponse.statusCode).toBe(200);
        expect(getByCodeResponse.body.code).toBe('IC045');
        expect(getByCodeResponse.body.name).toBe('Disciplina Publicada Alvo');
    });

    it('should return the exact draft by code even when there are similar codes', async () => {
        const similarDraftResponse = await supertest(app)
            .post('/api/component-drafts')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'IIC045',
                name: 'Disciplina Similar',
                department: 'Departamento Similar',
                semester: '2026.1',
                modality: 'Presencial',
                program: 'Programa Similar',
                objective: 'Objetivo Similar',
                syllabus: 'Ementa Similar',
                methodology: 'Metodologia Similar',
                learningAssessment: 'Avaliacao Similar',
                bibliography: 'Bibliografia Similar',
                prerequeriments: 'Nenhum',
            });

        expect(similarDraftResponse.statusCode).toBe(201);

        const targetDraftResponse = await supertest(app)
            .post('/api/component-drafts')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'IC045',
                name: 'Disciplina Alvo',
                department: 'Departamento Alvo',
                semester: '2026.1',
                modality: 'Presencial',
                program: 'Programa Alvo',
                objective: 'Objetivo Alvo',
                syllabus: 'Ementa Alvo',
                methodology: 'Metodologia Alvo',
                learningAssessment: 'Avaliacao Alvo',
                bibliography: 'Bibliografia Alvo',
                prerequeriments: 'Nenhum',
            });

        expect(targetDraftResponse.statusCode).toBe(201);

        const getByCodeResponse = await supertest(app)
            .get('/api/component-drafts/ic045')
            .set('Authorization', `Bearer ${token}`);

        expect(getByCodeResponse.statusCode).toBe(200);
        expect(getByCodeResponse.body.code).toBe('IC045');
        expect(getByCodeResponse.body.name).toBe('Disciplina Alvo');
    });

    it('should ignore non-whitelisted fields when updating a published component', async () => {
        const createResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'SAFE90',
                name: 'Disciplina Segura',
                department: 'Departamento Seguro',
                program: 'Programa Seguro',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Validar filtro de payload no update',
                syllabus: 'Ementa segura',
                bibliography: 'Bibliografia segura',
                modality: 'Presencial',
                learningAssessment: 'Provas',
            });

        expect(createResponse.statusCode).toBe(201);

        const createdComponentId = createResponse.body.id;
        const originalUserId = createResponse.body.userId;

        const updateResponse = await supertest(app)
            .put(`/api/components/${createdComponentId}`)
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Disciplina Segura Atualizada',
                userId: 'malicious-user-id',
                status: 'draft',
                createdAt: '2030-01-01T00:00:00.000Z',
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.name).toBe('Disciplina Segura Atualizada');
        expect(updateResponse.body.userId).toBe(originalUserId);
        expect(updateResponse.body.status).toBe('published');
    });

    it('should be able to export component pdf with approval metadata when available', async () => {
        const createResponse = await supertest(app)
            .post('/api/components')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .send({
                code: 'TEST123',
                name: 'Disciplina Teste',
                department: 'Departamento Teste',
                program: 'Programa Teste',
                semester: '2026.1',
                prerequeriments: 'Nenhum',
                methodology: 'Aulas expositivas',
                objective: 'Validar exportacao',
                syllabus: 'Ementa de teste',
                bibliography: 'Bibliografia de teste',
                modality: 'Presencial',
                learningAssessment: 'Provas e trabalhos',
            });

        expect(createResponse.statusCode).toBe(201);

        const componentResponse = await supertest(app)
            .get('/api/components/TEST123')
            .set('Authorization', `Bearer ${token}`);

        expect(componentResponse.statusCode).toBe(200);
        expect(componentResponse.body.draft?.id).toBeDefined();

        const updateDraftResponse = await supertest(app)
            .put(`/api/component-drafts/${componentResponse.body.draft.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                program: 'Programa Teste Atualizado',
                workload: {
                    studentTheory: 60,
                },
            });

        expect(updateDraftResponse.statusCode).toBe(200);

        const approveResponse = await supertest(app)
            .post(`/api/component-drafts/${componentResponse.body.draft.id}/approve`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                agreementNumber: '12345',
                agreementDate: '2026-05-01T12:00:00.000Z',
                signature: 'Assina123!',
            });

        expect(approveResponse.statusCode).toBe(200);

        const approvedComponentResponse = await supertest(app)
            .get('/api/components/TEST123')
            .set('Authorization', `Bearer ${token}`);

        expect(approvedComponentResponse.statusCode).toBe(200);
        expect(
            approvedComponentResponse.body.logs.some(
                (log: {
                    type: string;
                    agreementNumber?: string;
                    versionCode?: string;
                    officialProgram?: string;
                    description?: string;
                }) =>
                    log.type === 'approval'
                    && log.agreementNumber === '12345'
                    && log.versionCode === '0105202612345'
                    && log.officialProgram === 'Programa Teste Atualizado'
            )
        ).toBe(true);

        expect(
            approvedComponentResponse.body.logs.some(
                (log: {
                    type: string;
                    description?: string;
                }) =>
                    log.type === 'draft_update'
                    && log.description?.includes('program: "Programa Teste" -> "Programa Teste Atualizado"')
                    && log.description?.includes('workload.studentTheory')
                    && log.description?.includes('workload.studentTheory: 0 -> 60')
            )
        ).toBe(true);

        const exportResponse = await supertest(app)
            .get(`/api/components/${componentResponse.body.id}/export`)
            .buffer(true)
            .parse(binaryParser as never)
            .set('Authorization', `Bearer ${token}`);

        expect(exportResponse.statusCode).toBe(200);
        expect(exportResponse.headers['content-type']).toContain('application/pdf');
        expect(Buffer.isBuffer(exportResponse.body)).toBe(true);
        expect(exportResponse.body.length).toBeGreaterThan(0);
        expect((exportResponse.body as Buffer).subarray(0, 5).toString('utf8')).toBe('%PDF-');

        const docExportResponse = await supertest(app)
            .get(`/api/components/${componentResponse.body.id}/export?format=docx`)
            .buffer(true)
            .parse(binaryParser as never)
            .set('Authorization', `Bearer ${token}`);

        expect(docExportResponse.statusCode).toBe(200);
        expect(docExportResponse.headers['content-type']).toContain(
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        expect(docExportResponse.headers['content-disposition']).toContain('TEST123.docx');
        expect(Buffer.isBuffer(docExportResponse.body)).toBe(true);
        expect((docExportResponse.body as Buffer).subarray(0, 2).toString('utf8')).toBe('PK');

        const exportedDocZip = new AdmZip(docExportResponse.body as Buffer);
        const documentXml = exportedDocZip.readAsText('word/document.xml');

        expect(documentXml).toContain('TEST123');
        expect(documentXml).toContain('Disciplina Teste');
        expect(documentXml).toContain('Ementa de teste');
        expect(documentXml).not.toContain('IC045');
        expect(documentXml).not.toContain('Tópicos em Sistemas de Informação e Web I');
        expect(documentXml).not.toContain('Assinatura do docente');
    });
});