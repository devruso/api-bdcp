import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Component } from './Component';
import { ComponentDraft } from './ComponentDraft';
import { UserRole } from '../interfaces/UserRole';

@Entity('users')
class User {
    @PrimaryGeneratedColumn('uuid')
    readonly id: string;

    @Column()
        name: string;

    @Column({ unique: true })
        email: string;

    @Column()
        password: string;

    @Column({ name: 'is_user_active', default: true })
        isUserActive: boolean;

    @Column({ name: 'is_deleted', default: false })
        isDeleted: boolean;

    @Column({ default: UserRole.TEACHER })
        role: UserRole;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
        createdAt: Date;

    @UpdateDateColumn({
        name: 'updated_at',
        type: 'timestamptz',
        nullable: true,
    })
        updatedAt?: Date;

    @OneToMany(() => Component, (component) => component.user)
        components: Component[];

    @OneToMany(() => ComponentDraft, (component) => component.user)
        componentDrafts: ComponentDraft[];
}

export { User };
