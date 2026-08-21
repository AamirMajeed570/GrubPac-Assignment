/**
 * Unit tests — task assignment validation schemas.
 */

import { assignUserSchema, bulkUpdateStatusSchema } from '../../src/modules/tasks/task.schema';

describe('assignUserSchema', () => {
  it('accepts a valid UUID userId', () => {
    const result = assignUserSchema.safeParse({
      body: { userId: '550e8400-e29b-41d4-a716-446655440000' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID userId', () => {
    const result = assignUserSchema.safeParse({
      body: { userId: 'not-a-uuid' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing userId', () => {
    const result = assignUserSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });
});

describe('bulkUpdateStatusSchema', () => {
  it('accepts valid taskIds and status', () => {
    const result = bulkUpdateStatusSchema.safeParse({
      body: {
        taskIds: ['550e8400-e29b-41d4-a716-446655440000'],
        status: 'in_progress',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty taskIds array', () => {
    const result = bulkUpdateStatusSchema.safeParse({
      body: { taskIds: [], status: 'done' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status value', () => {
    const result = bulkUpdateStatusSchema.safeParse({
      body: {
        taskIds: ['550e8400-e29b-41d4-a716-446655440000'],
        status: 'invalid_status',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID in taskIds', () => {
    const result = bulkUpdateStatusSchema.safeParse({
      body: { taskIds: ['not-a-uuid'], status: 'todo' },
    });
    expect(result.success).toBe(false);
  });
});
