import path from 'path';
import supertest from 'supertest';
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
        const fixturePath = path.resolve(__dirname, '../../..', 'IC045.docx');

        const response = await supertest(app)
            .post('/api/component-drafts/import-preview')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', fixturePath, {
                contentType: DOCX_MIME_TYPE,
            });

        expect(response.statusCode).toBe(200);
        expect(response.body.fileName).toBe('IC045.docx');
        expect(response.body.mimeType).toBe(DOCX_MIME_TYPE);
        expect(response.body.suggestedDraft.code).toBe('IC045');
        expect(response.body.suggestedDraft.name).toContain('Tópicos');
        expect(response.body.rawText).toContain('PLANO DE ENSINO-APRENDIZAGEM');
        expect(Array.isArray(response.body.warnings)).toBe(true);
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

        const approveResponse = await supertest(app)
            .post(`/api/component-drafts/${componentResponse.body.draft.id}/approve`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                agreementNumber: '12345',
                agreementDate: '2026-05-01T12:00:00.000Z',
            });

        expect(approveResponse.statusCode).toBe(200);

        const approvedComponentResponse = await supertest(app)
            .get('/api/components/TEST123')
            .set('Authorization', `Bearer ${token}`);

        expect(approvedComponentResponse.statusCode).toBe(200);
        expect(
            approvedComponentResponse.body.logs.some(
                (log: { type: string; agreementNumber?: string }) =>
                    log.type === 'approval' && log.agreementNumber === '12345'
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
            .get(`/api/components/${componentResponse.body.id}/export?format=doc`)
            .buffer(true)
            .parse(binaryParser as never)
            .set('Authorization', `Bearer ${token}`);

        expect(docExportResponse.statusCode).toBe(200);
        expect(docExportResponse.headers['content-type']).toContain('application/msword');
        expect(docExportResponse.headers['content-disposition']).toContain('TEST123.doc');
        expect(Buffer.isBuffer(docExportResponse.body)).toBe(true);
        expect((docExportResponse.body as Buffer).toString('utf8')).toContain('PLANO DE ENSINO-APRENDIZAGEM');
    });
});