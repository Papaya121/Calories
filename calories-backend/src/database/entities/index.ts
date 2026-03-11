import { AuthPasscodeEntity } from './auth-passcode.entity';
import { AuthWebauthnCredentialEntity } from './auth-webauthn-credential.entity';
import { MealEntryEntity } from './meal-entry.entity';
import { MealPhotoEntity } from './meal-photo.entity';
import { SessionEntity } from './session.entity';
import { UserEntity } from './user.entity';

export const DATABASE_ENTITIES = [
  UserEntity,
  AuthPasscodeEntity,
  AuthWebauthnCredentialEntity,
  SessionEntity,
  MealEntryEntity,
  MealPhotoEntity,
];

export {
  UserEntity,
  AuthPasscodeEntity,
  AuthWebauthnCredentialEntity,
  SessionEntity,
  MealEntryEntity,
  MealPhotoEntity,
};
