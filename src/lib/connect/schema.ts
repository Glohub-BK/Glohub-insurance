import { z } from 'zod';

/**
 * 요청 본문 검증.
 *
 * 대상기관 규칙을 서버에서도 확인한다. 화면에서 막고 있지만, 화면을 거치지 않는
 * 요청이 들어올 수 있고, 형식이 틀린 채로 CODEF 에 보내면 실패 호출만 늘어난다
 * (그리고 CODEF 는 과도한 호출에 IP 를 막는다).
 */
export const credentialsSchema = z.object({
  loginId: z
    .string()
    .regex(/^[A-Za-z0-9]{6,12}$/, '아이디는 6~12자 영문·숫자여야 합니다'),
  password: z
    .string()
    .min(9, '비밀번호는 9자 이상이어야 합니다')
    .max(20, '비밀번호는 20자 이하여야 합니다')
    .refine(
      (v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v) && /[!@#$%^&*?_~]/.test(v),
      '비밀번호는 영문·숫자·특수문자(!@#$%^&*?_~)를 모두 포함해야 합니다',
    ),
  userName: z.string().min(1).max(30).optional(),
  phoneNo: z
    .string()
    .regex(/^01[0-9]{8,9}$/, '휴대폰 번호는 숫자만 입력하세요')
    .optional(),
  telecom: z.enum(['0', '1', '2', '3', '4', '5']).optional(),
  /** 표시용 이름. 실명일 필요가 없다. */
  memberName: z.string().min(1).max(20).default('본인'),
});

export const twoWaySchema = z.object({
  jobIndex: z.number().int(),
  threadIndex: z.number().int(),
  jti: z.string().min(1),
  twoWayTimestamp: z.number().int(),
});

export const startSchema = credentialsSchema;
export const continueSchema = credentialsSchema.extend({ twoWayInfo: twoWaySchema });

export type StartBody = z.infer<typeof startSchema>;
export type ContinueBody = z.infer<typeof continueSchema>;

/**
 * 검증 실패를 사용자 문장 하나로 줄인다.
 * zod 기본 메시지는 영어 타입 설명이라 그대로 보여주면 무엇을 고쳐야 할지 알 수 없다.
 */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return '입력값을 확인해주세요.';
  if (issue.path[0] === 'twoWayInfo') {
    return '인증 정보가 유실되었습니다. 처음부터 다시 시도해주세요.';
  }
  return issue.message;
}
