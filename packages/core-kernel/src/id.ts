import { randomUUID } from "node:crypto";

export interface IdGenerator {
  newId(): string;
}

export const uuidv4IdGenerator: IdGenerator = {
  newId: () => randomUUID(),
};
