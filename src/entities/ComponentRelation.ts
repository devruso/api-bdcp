import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';

import { Component } from './Component';
import { ComponentRelationType } from '../interfaces/ComponentRelationType';

@Entity('component_relations')
class ComponentRelation {

    @PrimaryGeneratedColumn('uuid')
    readonly id: string;

    @Column({ name: 'component_id' })
        componentId: string;

    @Column({ name: 'relation_type', enum: ComponentRelationType })
        relationType: ComponentRelationType;

    @Column({ name: 'related_code' })
        relatedCode: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
        createdAt: Date;

    @ManyToOne(() => Component, (component) => component.relations)
    @JoinColumn({ name: 'component_id' })
        component: Component;
}

export { ComponentRelation };
