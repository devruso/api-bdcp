import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Component } from './Component';
import { ComponentDraft } from './ComponentDraft';

@Entity('component_workloads')
class ComponentWorkload {

    @PrimaryGeneratedColumn('uuid')
    readonly id: string;

    @Column({ name: 'teacher_theory', default: 0 })
        teacherTheory?: number;

    @Column({ name: 'teacher_practice', default: 0 })
        teacherPractice?: number;

    @Column({ name: 'teacher_theory_practice', default: 0 })
        teacherTheoryPractice?: number;

    @Column({ name: 'teacher_internship', default: 0 })
        teacherInternship?: number;

    @Column({ name: 'teacher_practice_internship', default: 0 })
        teacherPracticeInternship?: number;

    @Column({ name: 'student_theory', default: 0 })
        studentTheory?: number;

    @Column({ name: 'student_practice', default: 0 })
        studentPractice?: number;

    @Column({ name: 'student_theory_practice', default: 0 })
        studentTheoryPractice?: number;

    @Column({ name: 'student_internship', default: 0 })
        studentInternship?: number;

    @Column({ name: 'student_practice_internship', default: 0 })
        studentPracticeInternship?: number;

    @Column({ name: 'module_theory', default: 0 })
        moduleTheory?: number;

    @Column({ name: 'module_practice', default: 0 })
        modulePractice?: number;

    @Column({ name: 'module_theory_practice', default: 0 })
        moduleTheoryPractice?: number;

    @Column({ name: 'module_internship', default: 0 })
        moduleInternship?: number;

    @Column({ name: 'module_practice_internship', default: 0 })
        modulePracticeInternship?: number;

    @OneToOne(() => Component, (component) => component.workload)
        component?: Component;

    @OneToOne(() => ComponentDraft, (component) => component.workload)
        componentDraft?: ComponentDraft;

}

export { ComponentWorkload };
