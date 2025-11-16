export class CreateUserResponse {
  user: {
    id: string;
    email: string;
    fullname: string;
    phone: string;
  };
  access_token: string;
  refresh_token: string;
}


