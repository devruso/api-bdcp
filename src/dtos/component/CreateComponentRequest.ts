import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Component } from '../../entities/Component';
import { ComponentWorkloadDto } from './ComponentWorkload';
import { CustomIsDefined, CustomIsString, CustomMatches } from '../../decorators/validation';
import { AcademicLevel } from '../../interfaces/AcademicLevel';


export class CreateComponentRequestDto
implements Omit<Component, 'id' | 'userId' | 'status' | 'logs' | 'relations' | 'user' | 'generateLog' | 'workload' | 'createdAt' | 'updatedAt' | 'publishDraft' | 'academicLevel'> {
    @CustomIsDefined()
    @CustomIsString()
    @CustomMatches(/^[A-Z]{2,4}[0-9]{2,4}$/)
    public code: string;

    @CustomIsDefined()
    @CustomIsString()
    public name: string;

    @CustomIsDefined()
    @CustomIsString()
    public department: string;

    @CustomIsDefined()
    @CustomIsString()
    public program: string;

    @CustomIsDefined()
    @CustomIsString()
    public semester: string;

    @CustomIsDefined()
    @CustomIsString()
    public prerequeriments: string;

    @CustomIsDefined()
    @CustomIsString()
    public methodology: string;

    @CustomIsDefined()
    @CustomIsString()
    public objective: string;

    @CustomIsDefined()
    @CustomIsString()
    public syllabus: string;

    @CustomIsDefined()
    @CustomIsString()
    public bibliography: string;
    
    @CustomIsDefined()
    @CustomIsString()
    public modality: string;

    @CustomIsDefined()
    @CustomIsString()
    public learningAssessment: string;

    @IsOptional()
    @CustomIsString()
    @CustomMatches(/^(graduacao|mestrado|doutorado)$/)
    public academicLevel?: AcademicLevel;
    
    public workloadId?: string;

    @IsOptional()
    @Type(() => ComponentWorkloadDto)
    @ValidateNested()
    public workload?: ComponentWorkloadDto;
}