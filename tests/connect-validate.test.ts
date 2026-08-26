import { describe, expect, it } from 'vitest';
import { validateLoginId, validatePassword } from '../src/app/connect/connect-flow';

/**
 * 대상기관(내보험다보여) 계정 규칙을 화면에서 먼저 막는다.
 * 여기서 통과시키면 CODEF 가 CF-12827 을 돌려주는데, 사용자는 이유를 알 수 없다.
 */
describe('validateLoginId', () => {
  it('빈 값은 아직 오류로 보지 않는다 (입력 시작 전)', () => {
    expect(validateLoginId('')).toBeNull();
  });

  it('6~12자 영문·숫자는 통과한다', () => {
    expect(validateLoginId('abc123')).toBeNull();
    expect(validateLoginId('a1b2c3d4e5f6')).toBeNull();
  });

  it('경계 밖 길이는 막는다', () => {
    expect(validateLoginId('abc12')).toMatch(/6자/);
    expect(validateLoginId('a1b2c3d4e5f6g')).toMatch(/12자/);
  });

  it('특수문자·공백·한글은 막는다', () => {
    expect(validateLoginId('abc-123')).toMatch(/특수문자/);
    expect(validateLoginId('abc 123')).toMatch(/특수문자/);
    expect(validateLoginId('홍길동12')).toMatch(/특수문자/);
  });
});

describe('validatePassword', () => {
  it('빈 값은 아직 오류로 보지 않는다', () => {
    expect(validatePassword('')).toBeNull();
  });

  it('영문·숫자·특수문자를 모두 포함한 9~20자는 통과한다', () => {
    expect(validatePassword('abcdefg1!')).toBeNull();
    expect(validatePassword('Abcdefghij12345678!!')).toBeNull();
  });

  it('길이 경계를 막는다', () => {
    expect(validatePassword('abcdef1!')).toMatch(/9자/);
    expect(validatePassword('Abcdefghij12345678!!x')).toMatch(/20자/);
  });

  it('세 종류를 다 채우지 못하면 막는다', () => {
    expect(validatePassword('abcdefghij')).toMatch(/특수문자/);
    expect(validatePassword('abcdefgh1')).toMatch(/특수문자/);
    expect(validatePassword('12345678!')).toMatch(/특수문자/);
  });

  it('허용 목록에 없는 특수문자는 종류로 세지 않는다', () => {
    // 대상기관이 받는 특수문자는 !@#$%^&*?_~ 뿐이다.
    expect(validatePassword('abcdefg1(')).toMatch(/특수문자/);
  });
});
