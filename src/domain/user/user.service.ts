import { Injectable } from "@nestjs/common";

@Injectable()
export class UserService {
    listOfUsers(): string {
        return 'Users';
    }
}