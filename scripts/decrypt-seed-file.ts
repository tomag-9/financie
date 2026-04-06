import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { mkdirSync } from 'fs'
import { decryptSeedBuffer, getSeedDecodePassword } from '../src/lib/seed-crypto'

function getArg(name: string): string | null {
  const prefix = `${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

function main() {
  const inputPath = resolve(process.cwd(), getArg('--input') ?? 'prisma/seed-data/Financie.xlsx.enc')
  const outputPath = resolve(process.cwd(), getArg('--output') ?? 'data/Financie.xlsx')
  const password = getSeedDecodePassword()

  const input = readFileSync(inputPath)
  const plain = decryptSeedBuffer(input, password)

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, plain)
  console.log(`Decrypted seed file written to ${outputPath}`)
}

main()
