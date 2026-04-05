import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { SettingsData } from '@/types'

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        password: { label: 'Heslo', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) return null

        const settings = await prisma.settings.findUnique({
          where: { id: 'singleton' },
        })
        const data = (settings?.data ?? {}) as SettingsData

        let passwordHash = data.password_hash

        // First-run bootstrap: hash ADMIN_PASSWORD from env and persist it.
        // Subsequent logins skip this block entirely.
        if (!passwordHash) {
          const adminPassword = process.env.ADMIN_PASSWORD
          if (!adminPassword) {
            console.error('[auth] No password_hash in DB and ADMIN_PASSWORD env not set.')
            return null
          }
          passwordHash = await bcrypt.hash(adminPassword, 12)
          const updatedData: SettingsData = { ...data, password_hash: passwordHash }
          await prisma.settings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', data: updatedData as object },
            update: { data: updatedData as object },
          })
        }

        const isValid = await bcrypt.compare(credentials.password as string, passwordHash)
        if (!isValid) return null

        return {
          id: 'tomi',
          name: 'Tomi',
          totpRequired: data.totp_enabled === true,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.totpRequired = user.totpRequired ?? false
        token.totpVerified = false
      }
      return token
    },
    async session({ session, token }) {
      session.user = { ...session.user, id: token.sub ?? 'tomi' }
      session.totpRequired = token.totpRequired ?? false
      session.totpVerified = token.totpVerified ?? false
      return session
    },
  },
})
