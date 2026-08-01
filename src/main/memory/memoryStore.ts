import { safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type MemoryScope = 'long-term' | 'daily-task' | 'temporary' | 'conversation' | 'project';

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  createdAt: string;
  encryptedPayload: string;
}

export interface PlainMemoryRecord {
  id: string;
  scope: MemoryScope;
  createdAt: string;
  text: string;
}

export class MemoryStore {
  constructor(private readonly root: string) {}

  async write(scopeOrRecord: MemoryScope | MemoryRecord, text?: string): Promise<void> {
    const record =
      typeof scopeOrRecord === 'string'
        ? this.createRecord(scopeOrRecord, text ?? '')
        : scopeOrRecord;

    if (!record.encryptedPayload) {
      return;
    }

    const records = this.readRecords(record.scope);
    records.push(record);
    this.writeRecords(record.scope, records.slice(-200));
  }

  async search(scope: MemoryScope | 'all', query: string, limit = 8): Promise<PlainMemoryRecord[]> {
    const scopes: MemoryScope[] =
      scope === 'all'
        ? ['long-term', 'daily-task', 'temporary', 'conversation', 'project']
        : [scope];

    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2);

    const memories = scopes.flatMap((memoryScope) =>
      this.readRecords(memoryScope).map((record) => this.decryptRecord(record)).filter(Boolean)
    ) as PlainMemoryRecord[];

    return memories
      .filter((record) => {
        if (!terms.length) {
          return true;
        }

        const haystack = record.text.toLowerCase();
        return terms.some((term) => haystack.includes(term));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async seedDefaults(): Promise<void> {
    const existing = await this.search('long-term', 'Bowen mechatronic coding building', 1);
    if (existing.length) {
      return;
    }

    await this.write(
      'long-term',
      'The user wants to be a mechatronic engineer, is about to enter Bowen University, and loves coding and building.'
    );
  }

  private createRecord(scope: MemoryScope, text: string): MemoryRecord {
    const payload = text.trim();
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      scope,
      createdAt: new Date().toISOString(),
      encryptedPayload: this.encrypt(payload)
    };
  }

  private decryptRecord(record: MemoryRecord): PlainMemoryRecord | null {
    const text = this.decrypt(record.encryptedPayload);
    if (!text) {
      return null;
    }

    return {
      id: record.id,
      scope: record.scope,
      createdAt: record.createdAt,
      text
    };
  }

  private readRecords(scope: MemoryScope): MemoryRecord[] {
    const filePath = this.scopePath(scope);
    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeRecords(scope: MemoryScope, records: MemoryRecord[]): void {
    const filePath = this.scopePath(scope);
    mkdirSync(join(filePath, '..'), { recursive: true });
    writeFileSync(filePath, JSON.stringify(records, null, 2));
  }

  private scopePath(scope: MemoryScope): string {
    const folderName: Record<MemoryScope, string> = {
      'long-term': 'LongTerm',
      'daily-task': 'DailyTasks',
      temporary: 'Temporary',
      conversation: 'Conversations',
      project: 'Projects'
    };
    return join(this.root, 'System', 'Memory', folderName[scope], 'records.json');
  }

  private encrypt(text: string): string {
    if (!text) {
      return '';
    }

    if (safeStorage.isEncryptionAvailable()) {
      return `safe:${safeStorage.encryptString(text).toString('base64')}`;
    }

    return `base64:${Buffer.from(text, 'utf8').toString('base64')}`;
  }

  private decrypt(value: string): string {
    try {
      if (value.startsWith('safe:')) {
        return safeStorage.decryptString(Buffer.from(value.slice(5), 'base64'));
      }

      if (value.startsWith('base64:')) {
        return Buffer.from(value.slice(7), 'base64').toString('utf8');
      }
    } catch {
      return '';
    }

    return '';
  }
}
