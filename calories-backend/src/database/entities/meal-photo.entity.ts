import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MealEntryEntity } from './meal-entry.entity';

@Entity({ name: 'meal_photos' })
export class MealPhotoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'meal_entry_id', type: 'uuid' })
  mealEntryId!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'width', type: 'integer', nullable: true })
  width!: number | null;

  @Column({ name: 'height', type: 'integer', nullable: true })
  height!: number | null;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => MealEntryEntity, (mealEntry) => mealEntry.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meal_entry_id' })
  mealEntry!: MealEntryEntity;
}
