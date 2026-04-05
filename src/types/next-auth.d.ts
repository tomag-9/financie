import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    totpRequired: boolean
    totpVerified: boolean
  }
  interface User {
    totpRequired?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    totpRequired: boolean
    totpVerified: boolean
  }
}
