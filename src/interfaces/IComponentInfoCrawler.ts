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
    workload?: {
        theoretical: number;
        practice: number;
        internship: number;
    }
}