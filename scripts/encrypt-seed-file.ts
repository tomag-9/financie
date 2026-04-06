import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { mkdirSync } from 'fs'
import { encryptSeedBuffer, getSeedEncodePassword } from '../src/lib/seed-crypto'

function getArg(name: string): string | null {
  const prefix = `${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

function main() {
  const inputPath = resolve(process.cwd(), getArg('--input') ?? 'data/Financie.xlsx')
  const outputPath = resolve(process.cwd(), getArg('--output') ?? 'prisma/seed-data/Financie.xlsx.enc')
  const password = getSeedEncodePassword()

  const input = readFileSync(inputPath)
  const encrypted = encryptSeedBuffer(input, password)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, encrypted)
  console.log(`Encrypted seed file written to ${outputPath}`)
}

main()
