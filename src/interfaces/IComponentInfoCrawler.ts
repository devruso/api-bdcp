import { AcademicLevel } from './AcademicLevel';

export interface IComponentInfoCrawler {
    code: string;
    name: string;
    department: string;
    semester: string; // 2007.2
    description: string;
    objective: string;
    syllabus: string;
    bibliography: string;
    prerequeriments?: string;
    methodology?: string;
    modality?: string;
    learningAssessment?: string;
    academicLevel?: AcademicLevel;
    detailUrl?: string;
    detailActionUrl?: string;
    detailActionPayload?: string;
    coRequisites?: string[];
    equivalences?: string[];
    workloadExtension?: number;
    workload?: {
        theoretical: number;
        practice: number;
        internship: number;
    }
}