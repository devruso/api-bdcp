import { IsOptional } from 'class-validator';
import { CustomIsNumber, CustomMin } from '../../decorators/validation';
import { ComponentWorkload } from '../../entities/ComponentWorkload';

export class ComponentWorkloadDto implements Omit<ComponentWorkload, 'id'> {
    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public teacherTheory?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public teacherPractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public teacherTheoryPractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public teacherInternship?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public teacherPracticeInternship?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public studentTheory?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public studentPractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public studentTheoryPractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public studentInternship?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public studentPracticeInternship?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public moduleTheory?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public modulePractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public moduleTheoryPractice?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public moduleInternship?: number;

    @IsOptional()
    @CustomIsNumber()
    @CustomMin(0)
    public modulePracticeInternship?: number;
}