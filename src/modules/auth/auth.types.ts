export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  organizationId: string; // join an existing org on register
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
    organizationName: string;
  };
  tokens: AuthTokens;
}
