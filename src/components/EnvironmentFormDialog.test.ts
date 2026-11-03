import { describe, expect, it } from 'vitest';
import { configFields, orgSecretPrefix } from '@/components/EnvironmentFormDialog';

describe('configFields', () => {
  it('configSchema 의 속성을 입력칸으로 바꾸고, enum 은 선택지로 둔다', () => {
    const fields = configFields({
      kind: 'gcp',
      configSchema: {
        properties: {
          projectId: { type: 'string', examples: ['echo-hack-123'] },
          region: { type: 'string', enum: ['asia-northeast3'] },
        },
        required: ['projectId'],
      },
    });

    expect(fields).toEqual([
      {
        key: 'projectId',
        label: 'Project ID',
        required: true,
        options: undefined,
        hint: 'e.g. echo-hack-123',
      },
      {
        key: 'region',
        label: 'Region',
        required: false,
        options: ['asia-northeast3'],
        hint: undefined,
      },
    ]);
  });
});

describe('orgSecretPrefix', () => {
  it('조직 slug 의 - 를 _ 로 바꾸고 대문자로 만든다', () => {
    expect(orgSecretPrefix('team-echo')).toBe('env:ECHO_SECRET_TEAM_ECHO__');
  });
});
