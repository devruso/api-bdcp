import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ComponentStatus } from '../../../interfaces/ComponentStatus';
import { splitBibliographySections } from '../../referenceSections';

type WorkloadGroup = {
    theory?: number;
    theoryPractice?: number;
    practice?: number;
    practiceInternship?: number;
    extension?: number;
    internship?: number;
};

export interface GenerateHtmlData {
    id: string;
    userId: string;
    workloadId?: string;
    status: ComponentStatus;
    code: string;
    name: string;
    department: string;
    modality: string;
    program: string;
    semester: string;
    prerequeriments: string;
    methodology: string;
    objective: string;
    syllabus: string;
    learningAssessment: string;
    bibliography: string;
    referencesBasic?: string;
    referencesComplementary?: string;
    approval?: {
        agreementNumber?: string;
        agreementDate?: Date;
        approvedBy?: string;
    };
    workload?: {
        student: WorkloadGroup;
        professor: WorkloadGroup;
        module: WorkloadGroup;
    };
    exportMode?: 'pdf' | 'docx';
}

const fallback = (value?: string, empty = 'Nao informado') =>
    value && value.trim() ? value : empty;

const formatDate = (value?: Date) => {
    if (!value) {
        return '___/___/____';
    }

    const date = new Date(value);

    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

const totalWorkload = (group?: WorkloadGroup) =>
    (group?.theory ?? 0)
    + (group?.theoryPractice ?? 0)
    + (group?.practice ?? 0)
    + (group?.practiceInternship ?? 0)
    + (group?.extension ?? 0)
    + (group?.internship ?? 0);

const WorkloadTable = ({
    title,
    group,
    showTotal = true,
}: {
    title: string;
    group?: WorkloadGroup;
    showTotal?: boolean;
}) => (
    <div className="workload-box">
        <div className="field-header">{title}</div>
        <table>
            <thead>
                <tr>
                    <th>T</th>
                    <th>T/P</th>
                    <th>P</th>
                    <th>PP</th>
                    <th>Ext</th>
                    <th>E</th>
                    {showTotal && <th>Total</th>}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{group?.theory ?? 0}</td>
                    <td>{group?.theoryPractice ?? 0}</td>
                    <td>{group?.practice ?? 0}</td>
                    <td>{group?.practiceInternship ?? 0}</td>
                    <td>{group?.extension ?? 0}</td>
                    <td>{group?.internship ?? 0}</td>
                    {showTotal && <td>{totalWorkload(group)}</td>}
                </tr>
            </tbody>
        </table>
    </div>
);

export function generateHtml(data: GenerateHtmlData) {
    const approvalDate = data.approval?.agreementDate ? formatDate(data.approval.agreementDate) : 'Nao informada';
    const approvalNumber = fallback(data.approval?.agreementNumber, 'Nao informada');
    const approvalResponsible = fallback(data.approval?.approvedBy, 'Nao informado');
    const legacySections = splitBibliographySections(data.bibliography);
    const bibliographySections = {
        basic: fallback(data.referencesBasic || legacySections.basic),
        complementary: fallback(data.referencesComplementary || legacySections.complementary),
    };

    return renderToStaticMarkup(
        <html>
            <head>
                <meta charSet="UTF-8" />
                <title>Plano de Ensino-Aprendizagem</title>
                <style>
                    {`
                        @page {
                            size: A4;
                            margin: 14mm 11mm;
                        }

                        * {
                            box-sizing: border-box;
                        }

                        body {
                            margin: 0;
                            color: #111;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 11px;
                            line-height: 1.35;
                        }

                        .header,
                        .section-title,
                        .grid,
                        .meta-grid,
                        .workload-grid,
                        .text-block,
                        .references,
                        .approval {
                            width: 100%;
                        }

                        .header {
                            display: flex;
                            border: 1px solid #222;
                        }

                        .brand {
                            width: 90px;
                            border-right: 1px solid #222;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 700;
                            font-size: 20px;
                            letter-spacing: 2px;
                        }

                        .header-copy {
                            flex: 1;
                            padding: 10px 12px;
                            text-align: center;
                        }

                        .title-main {
                            font-size: 14px;
                            font-weight: 700;
                        }

                        .title-sub {
                            margin-top: 4px;
                            font-size: 12px;
                            font-weight: 700;
                        }

                        .title-doc {
                            margin-top: 8px;
                            border: 1px solid #222;
                            padding: 8px 10px;
                            text-align: center;
                            font-size: 14px;
                            font-weight: 700;
                        }

                        .semester-line {
                            margin-top: 4px;
                            text-align: right;
                            font-weight: 700;
                        }

                        .section-title {
                            margin-top: 10px;
                            border: 1px solid #222;
                            background: #ececec;
                            padding: 5px 8px;
                            text-align: center;
                            font-weight: 700;
                            text-transform: uppercase;
                        }

                        .grid,
                        .meta-grid,
                        .workload-grid,
                        .references {
                            display: grid;
                            border-left: 1px solid #222;
                            border-right: 1px solid #222;
                            border-bottom: 1px solid #222;
                        }

                        .grid {
                            grid-template-columns: 1fr 2fr 1.35fr;
                        }

                        .meta-grid {
                            grid-template-columns: 1.7fr 1.1fr 1fr;
                        }

                        .workload-grid {
                            grid-template-columns: 1.15fr 1.15fr 1.15fr 0.85fr;
                        }

                        .references {
                            grid-template-columns: 1fr 1fr;
                        }

                        .cell,
                        .workload-box,
                        .reference-box {
                            border-right: 1px solid #222;
                        }

                        .cell:last-child,
                        .workload-box:last-child,
                        .reference-box:last-child {
                            border-right: none;
                        }

                        .field-header {
                            min-height: 28px;
                            padding: 4px 6px;
                            border-bottom: 1px solid #222;
                            background: #f7f7f7;
                            font-size: 10px;
                            font-weight: 700;
                            text-transform: uppercase;
                        }

                        .field-value,
                        .reference-content,
                        .summary {
                            min-height: 42px;
                            padding: 7px 6px;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }

                        th,
                        td {
                            border-right: 1px solid #222;
                            border-bottom: 1px solid #222;
                            padding: 4px 2px;
                            text-align: center;
                            font-size: 10px;
                        }

                        th:last-child,
                        td:last-child {
                            border-right: none;
                        }

                        .workload-box tbody tr:last-child td {
                            border-bottom: none;
                        }

                        .text-block,
                        .approval {
                            border-left: 1px solid #222;
                            border-right: 1px solid #222;
                            border-bottom: 1px solid #222;
                            padding: 8px 10px;
                            white-space: pre-wrap;
                            text-align: justify;
                        }

                        .reference-box {
                            min-height: 120px;
                        }

                        .reference-content {
                            white-space: pre-wrap;
                        }

                        .approval {
                            min-height: 92px;
                        }

                        .approval-meta {
                            display: grid;
                            gap: 6px;
                            margin-top: 10px;
                        }

                        .approval-line {
                            margin-top: 12px;
                        }
                    `}
                </style>
            </head>
            <body>
                <section className="header">
                    <div className="brand">UFBA</div>
                    <div className="header-copy">
                        <div className="title-main">UNIVERSIDADE FEDERAL DA BAHIA</div>
                        <div className="title-sub">PRO-REITORIA DE ENSINO DE GRADUACAO</div>
                        <div>Plano de ensino-aprendizagem de componente curricular</div>
                    </div>
                </section>

                <section className="title-doc">PLANO DE ENSINO-APRENDIZAGEM DO COMPONENTE CURRICULAR</section>
                <div className="semester-line">Semestre: {fallback(data.semester)}</div>

                <section className="section-title">Dados de identificacao e atributos</section>
                <section className="grid">
                    <div className="cell">
                        <div className="field-header">Codigo</div>
                        <div className="field-value">{fallback(data.code)}</div>
                    </div>
                    <div className="cell">
                        <div className="field-header">Nome</div>
                        <div className="field-value">{fallback(data.name)}</div>
                    </div>
                    <div className="cell">
                        <div className="field-header">Departamento ou equivalente</div>
                        <div className="field-value">{fallback(data.department)}</div>
                    </div>
                </section>

                <section className="meta-grid">
                    <div className="cell">
                        <div className="field-header">Modalidade / Submodalidade</div>
                        <div className="field-value">{fallback(data.modality)}</div>
                    </div>
                    <div className="cell">
                        <div className="field-header">Pre-requisito (por curso)</div>
                        <div className="field-value">{fallback(data.prerequeriments, 'Nao se aplica')}</div>
                    </div>
                    <div className="cell">
                        <div className="field-header">Semestre de inicio da vigencia</div>
                        <div className="field-value">{fallback(data.semester)}</div>
                    </div>
                </section>

                <section className="workload-grid">
                    <WorkloadTable title="Carga horaria (estudante)" group={data.workload?.student} />
                    <WorkloadTable title="Carga horaria (docente/turma)" group={data.workload?.professor} />
                    <WorkloadTable title="Modulo" group={data.workload?.module} showTotal={false} />
                    <div className="workload-box">
                        <div className="field-header">Resumo</div>
                        <div className="summary">
                            <div>Total estudante: {totalWorkload(data.workload?.student)}h</div>
                            <div>Total docente: {totalWorkload(data.workload?.professor)}h</div>
                            <div>Total modulo: {totalWorkload(data.workload?.module)}h</div>
                        </div>
                    </div>
                </section>

                <section className="section-title">Ementa</section>
                <section className="text-block">{fallback(data.syllabus)}</section>

                <section className="section-title">Objetivos</section>
                <section className="text-block">{fallback(data.objective)}</section>

                <section className="section-title">Conteudo programatico</section>
                <section className="text-block">{fallback(data.program)}</section>

                <section className="section-title">Metodologia de ensino-aprendizagem</section>
                <section className="text-block">{fallback(data.methodology)}</section>

                <section className="section-title">Avaliacao da aprendizagem</section>
                <section className="text-block">{fallback(data.learningAssessment)}</section>

                <section className="section-title">Referencias</section>
                <section className="references">
                    <div className="reference-box">
                        <div className="field-header">Referencias basicas</div>
                        <div className="reference-content">{bibliographySections.basic}</div>
                    </div>
                    <div className="reference-box">
                        <div className="field-header">Referencias complementares</div>
                        <div className="reference-content">{bibliographySections.complementary}</div>
                    </div>
                </section>

                <section className="section-title">Aprovacao</section>
                <section className="approval">
                    <div>Metadados da publicacao oficial registrados no sistema institucional.</div>
                    <div className="approval-meta">
                        <div><strong>Responsavel pela publicacao:</strong> {approvalResponsible}</div>
                        <div><strong>Data de aprovacao:</strong> {approvalDate}</div>
                        <div><strong>Ata ou referencia:</strong> {approvalNumber}</div>
                    </div>
                    <div className="approval-line">
                        Quando a disciplina ainda nao possui aprovacao formal registrada, esses campos permanecem informativos e nao substituem a homologacao institucional.
                    </div>
                </section>
            </body>
        </html>
    );
}