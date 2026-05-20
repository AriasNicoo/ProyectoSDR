import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/** País por defecto cuando el número no trae prefijo internacional (+...) */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'CL'

function preprocessRawInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  let str = String(raw).trim()
  if (!str || str.toUpperCase() === 'N/A') return null

  // Notación científica de Excel: "5.6979E+10" o "5,6979E+10"
  if (str.toUpperCase().includes('E+')) {
    try {
      const num = Number(str.replace(',', '.'))
      if (!isNaN(num)) {
        str = num >= 1e10 ? num.toFixed(0) : String(Math.round(num))
      }
    } catch {
      /* mantener str original */
    }
  }

  return str
}

/** Evita números pegados dos veces al copiar/pegar */
function dedupeDigitString(digits: string): string {
  if (
    digits.length > 12 &&
    digits.startsWith(digits.substring(Math.floor(digits.length / 2)))
  ) {
    return digits.substring(0, Math.floor(digits.length / 2))
  }
  return digits
}

function toStoredE164(parsed: ReturnType<typeof parsePhoneNumberFromString>): string | null {
  if (!parsed?.isValid()) return null
  return parsed.format('E.164').replace('+', '')
}

function tryParse(input: string, defaultCountry?: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry)
  return toStoredE164(parsed)
}

/**
 * Normaliza cualquier teléfono a dígitos E.164 sin "+" (ej: 56912345678, 14155552671, 34612345678).
 * - Con prefijo internacional (+34, +1, +52…): detecta el país automáticamente.
 * - Sin prefijo: interpreta según defaultCountry (Chile por defecto, compatibilidad actual).
 */
export function normalizePhoneNumber(
  raw: unknown,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string | null {
  const preprocessed = preprocessRawInput(raw)
  if (!preprocessed) return null

  // Formato escrito tal cual (+34 612…, (56) 9…, 9 1234 5678 en CL, etc.)
  const direct = tryParse(preprocessed, defaultCountry)
  if (direct) return direct

  const digitsOnly = dedupeDigitString(preprocessed.replace(/\D/g, ''))
  if (!digitsOnly) return null

  // Número ya en formato internacional solo dígitos (ej: 34612345678, 14155552671)
  const international = tryParse(`+${digitsOnly}`)
  if (international) return international

  // Formato nacional sin código de país (ej: 912345678 en Chile)
  const national = tryParse(digitsOnly, defaultCountry)
  if (national) return national

  return null
}

/** Indica si hay un teléfono usable para WhatsApp */
export function hasValidPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false
  return normalizePhoneNumber(phone) !== null
}
