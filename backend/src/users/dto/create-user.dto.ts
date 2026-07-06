export class CreateUserDto {
  fullName: string;
  email: string;
  whatsappNumber: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  password: string;
}
