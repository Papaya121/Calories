import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { MealPhotoEntity } from './meal-photo.entity';

@Index(['userId', 'eatenAt'])
@Entity({ name: 'meal_entries' })
export class MealEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'eaten_at', type: 'timestamptz' })
  eatenAt!: Date;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'dish_name', type: 'varchar', length: 180 })
  dishName!: string;

  @Column({ name: 'dish_description', type: 'text', nullable: true })
  dishDescription!: string | null;

  @Column({ name: 'calories_kcal', type: 'integer' })
  caloriesKcal!: number;

  @Column({ name: 'protein_g', type: 'real' })
  proteinG!: number;

  @Column({ name: 'fat_g', type: 'real' })
  fatG!: number;

  @Column({ name: 'carbs_g', type: 'real' })
  carbsG!: number;

  @Column({ name: 'ai_confidence', type: 'real', default: 0 })
  aiConfidence!: number;

  @Column({ name: 'ai_model', type: 'varchar', length: 120, nullable: true })
  aiModel!: string | null;

  @Column({ name: 'is_user_edited', type: 'boolean', default: false })
  isUserEdited!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.mealEntries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @OneToMany(() => MealPhotoEntity, (photo) => photo.mealEntry, {
    cascade: ['insert'],
  })
  photos!: MealPhotoEntity[];
}
