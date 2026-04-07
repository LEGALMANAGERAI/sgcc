import { randomUUID, randomBytes } from "crypto";

export function generarTokenFirma(): string {
  return `${randomUUID()}-${randomBytes(16).toString("hex")}`;
}
