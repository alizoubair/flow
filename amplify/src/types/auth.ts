export interface User {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
