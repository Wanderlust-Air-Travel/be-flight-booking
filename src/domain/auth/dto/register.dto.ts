import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class RegisterDto {
    @IsNotEmpty()
    fullname: string;

    @IsEmail()
    email: string;

    @MinLength(6)
    password: string;

    @IsNotEmpty()
    phone: string;
}