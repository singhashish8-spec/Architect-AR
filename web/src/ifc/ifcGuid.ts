// IFC GlobalId <-> standard UUID conversion.
//
// Why this exists: web-ifc reads an element's GlobalId in IFC's own
// compressed form (22 base64-like characters, e.g. "2O2Fr$t4X7Zf8NOew3FKau").
// But not every glTF exporter names nodes using that same compressed
// string -- IfcOpenShell's own glTF serializer (a real, commonly-used
// open-source IFC-to-glTF converter) names nodes
// "product-<expanded-uuid>-body" using the *expanded*, standard
// hyphenated UUID form instead (e.g.
// "product-9808fd7f-1a92-405e-9ac9-d59067be1d42-body"). Verified directly
// against IfcOpenShell 0.8.5's own reference implementation
// (ifcopenshell/guid.py) and a real IFC file -- see
// docs/history/sessions/ for the session this was found in. Without this,
// the tap-to-inspect correlation silently fails for any exporter using the
// expanded form, which is not a hypothetical edge case.
//
// Algorithm ported faithfully from ifcopenshell.guid (the authoritative
// reference implementation): pad the hex UUID, base64-encode/decode it,
// then translate between standard base64's alphabet and IFC's own
// (digits-then-uppercase-then-lowercase-then-"_$", not the RFC 4648 order).

const CHARS64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const CHARS64_IFC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'

function translate(str: string, from: string, to: string): string {
  const map = new Map<string, string>()
  for (let i = 0; i < from.length; i++) map.set(from[i], to[i])
  return str
    .split('')
    .map((c) => map.get(c) ?? c)
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return s
}

function binaryStringToBytes(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// "2O2Fr$t4X7Zf8NOew3FKau" -> "9808fd7fdc48478e9217628e833d4938" (32 hex
// chars, no dashes -- use hyphenateUuid() below to get xxxxxxxx-xxxx-...).
export function expandIfcGuid(guid: string): string {
  const std = translate(guid, CHARS64_IFC, CHARS64_STD)
  const bytes = binaryStringToBytes(atob('AA' + std))
  return bytesToHex(bytes).slice(4)
}

// The reverse of expandIfcGuid() -- not currently used at runtime, kept for
// completeness/testing since it's the same algorithm run the other way.
export function compressToIfcGuid(hexUuid: string): string {
  const clean = hexUuid.toLowerCase().replace(/[^0-9a-f]/g, '')
  const bytes = hexToBytes('0000' + clean)
  const std = btoa(bytesToBinaryString(bytes))
  return translate(std.slice(2), CHARS64_STD, CHARS64_IFC)
}

export function hyphenateUuid(hex32: string): string {
  return [hex32.slice(0, 8), hex32.slice(8, 12), hex32.slice(12, 16), hex32.slice(16, 20), hex32.slice(20)].join('-')
}
