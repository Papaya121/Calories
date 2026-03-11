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
