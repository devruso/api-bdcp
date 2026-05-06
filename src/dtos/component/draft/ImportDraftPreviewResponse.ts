import { ComponentWorkload } from '../../../entities/ComponentWorkload';

type ImportDraftPreviewWorkload = Omit<
    Partial<ComponentWorkload>,
    'id' | 'component' | 'componentDraft'
>;

export interface ImportDraftPreviewPayload {
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
    workload: ImportDraftPreviewWorkload;
}

export interface ImportDraftPreviewResponseDto {
    fileName: string;
    mimeType: string;
    suggestedDraft: ImportDraftPreviewPayload;
    warnings: string[];
    unrecognizedSections: string[];
    extractedSections: Record<string, string>;
    rawText: string;
}