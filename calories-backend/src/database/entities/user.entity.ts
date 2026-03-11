import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthPasscodeEntity } from './auth-passcode.entity';
import { AuthWebauthnCredentialEntity } from './auth-webauthn-credential.entity';
import { SessionEntity } from './session.entity';
import { MealEntryEntity } from './meal-entry.entity';

export type BiologicalSex = 'male' | 'female';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  displayName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    name: 'biological_sex',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  biologicalSex!: BiologicalSex | null;

  @Column({ name: 'weight_kg', type: 'real', nullable: true })
  weightKg!: number | null;

  @Column({ name: 'height_cm', type: 'int', nullable: true })
  heightCm!: number | null;

  @Column({ name: 'age_years', type: 'int', nullable: true })
  ageYears!: number | null;

  @Column({
    name: 'activity_level',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  activityLevel!: ActivityLevel | null;

  @Column({
    name: 'goal_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  goalType!: GoalType | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => AuthPasscodeEntity, (passcode) => passcode.user)
  passcode?: AuthPasscodeEntity;

  @OneToMany(
    () => AuthWebauthnCredentialEntity,
    (credential) => credential.user,
  )
  webauthnCredentials?: AuthWebauthnCredentialEntity[];

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions?: SessionEntity[];

  @OneToMany(() => MealEntryEntity, (mealEntry) => mealEntry.user)
  mealEntries?: MealEntryEntity[];
}
