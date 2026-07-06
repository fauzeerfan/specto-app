export class UpdateUserDto {
  username?: string;
  fullName?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'operator' | 'viewer';
  whatsappNumber?: string;
}
